"""Tiny in-memory stand-in for the supabase-py client: just enough chainable query API
(select/insert/update/upsert/eq/ilike/order/limit/execute, rpc, auth.get_user) for route tests."""
import itertools
import uuid
from types import SimpleNamespace

_ids = itertools.count(1)


class Query:
    def __init__(self, db, name):
        self.db, self.name = db, name
        self.op, self.payload, self.filters, self._order, self._limit, self._on_conflict = "select", None, [], None, None, None

    def select(self, *_a, **_k): return self
    def insert(self, row): self.op, self.payload = "insert", row; return self
    def update(self, row): self.op, self.payload = "update", row; return self
    def upsert(self, row, on_conflict=None): self.op, self.payload, self._on_conflict = "upsert", row, on_conflict; return self
    def eq(self, col, val): self.filters.append(("eq", col, val)); return self
    def ilike(self, col, val): self.filters.append(("ilike", col, val)); return self
    def gte(self, col, val): self.filters.append(("gte", col, val)); return self
    def in_(self, col, vals): self.filters.append(("in", col, list(vals))); return self
    def order(self, col, desc=False): self._order = (col, desc); return self
    def limit(self, n): self._limit = n; return self

    def _match(self, row):
        for kind, col, val in self.filters:
            if kind == "eq" and row.get(col) != val:
                return False
            if kind == "gte" and not (row.get(col) is not None and str(row.get(col)) >= str(val)):
                return False
            if kind == "in" and row.get(col) not in val:
                return False
            if kind == "ilike" and str(row.get(col, "")).lower() != str(val).replace("\\", "").lower():
                return False
        return True

    def execute(self):
        rows = self.db.tables.setdefault(self.name, [])
        if self.op == "insert":
            row = {"id": str(uuid.uuid4()), "status": "active" if self.name == "care_links" else None, **self.payload}
            row = {k: v for k, v in row.items() if v is not None or k in self.payload}
            row.setdefault("created_at", f"2026-10-12T00:00:{next(_ids):02d}+00:00")
            if self.name == "care_links" and any(
                r["therapist_id"] == row["therapist_id"] and r["patient_id"] == row["patient_id"] and r["status"] == "active"
                for r in rows
            ):
                raise RuntimeError("duplicate key value violates unique constraint")
            if self.db.fail_insert == self.name:
                raise RuntimeError("boom")
            rows.append(row)
            return SimpleNamespace(data=[dict(row)])
        if self.op == "upsert":
            for r in rows:
                if r.get(self._on_conflict) == self.payload.get(self._on_conflict):
                    r.update(self.payload)
                    return SimpleNamespace(data=[dict(r)])
            rows.append({"id": str(uuid.uuid4()), **self.payload})
            return SimpleNamespace(data=[dict(rows[-1])])
        matched = [r for r in rows if self._match(r)]
        if self.op == "update":
            for r in matched:
                r.update(self.payload)
            return SimpleNamespace(data=[dict(r) for r in matched])
        if self._order:
            matched.sort(key=lambda r: r.get(self._order[0]) or "", reverse=self._order[1])
        if self._limit:
            matched = matched[: self._limit]
        return SimpleNamespace(data=[dict(r) for r in matched])


class Rpc:
    def __init__(self, db, name, params): self.db, self.name, self.params = db, name, params
    def execute(self):
        self.db.rpc_calls.append((self.name, self.params))
        if self.db.rpc_error:
            raise Exception(self.db.rpc_error)
        return SimpleNamespace(data=None)


class FakeSupabase:
    def __init__(self):
        self.tables, self.rpc_calls, self.rpc_error, self.fail_insert = {}, [], None, None
        self.tokens = {}  # bearer token -> auth user
        self.auth = SimpleNamespace(get_user=self._get_user)

    def _get_user(self, token):
        if token not in self.tokens:
            raise Exception("invalid jwt")
        return SimpleNamespace(user=self.tokens[token])

    def table(self, name): return Query(self, name)
    def rpc(self, name, params): return Rpc(self, name, params)

    # ---- fixtures ----
    def add_user(self, uid, role, email, *, confirmed=True, office=None, first="Test", last=None, token=None):
        self.tables.setdefault("users", []).append({
            "id": uid, "role": role, "active": True, "office_id": office, "email": email,
            "first_name": first, "last_name": last, "full_name": None,
        })
        self.tokens[token or f"tok-{uid}"] = SimpleNamespace(
            id=uid, email=email, email_confirmed_at="2026-10-01T00:00:00Z" if confirmed else None
        )
        return {"Authorization": f"Bearer {token or f'tok-{uid}'}"}
