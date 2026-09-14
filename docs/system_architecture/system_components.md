# 1. Client Layer
## Patient Mobile Application (iOS / Android)

### Core Features:
Interactive exercise player with play/pause animations, real-time device motion capture (accelerometer/gyroscope telemetry), schedule dashboard, and health profile viewer.

### Security & Auth:
Native Face ID / Touch ID local authentication, JWT session persistence, phone/email verification onboarding flows.

### Notifications:
Local/push notification listener for daily exercise reminders.

## Therapist / Administrator Web Portal

### Core Features:
User account management, custom exercise plan assignment, progress/compliance analytics dashboard.

### Admin Overrides:
Password/MFA resets, manual account deactivations, account email updates, and tier overrides.

# 2. API & Backend Service Layer (Python FastAPI / Flask)
## Auth & User Management Service: 
Handles registration, email/phone verification verification tokens, biometrics verification handshakes, and Role-Based Access Control (RBAC: Patient vs. Admin).

## Exercise & Telemetry Engine: 
Processes device sensor payload streams, validates exercise completion/reps, and aggregates tracking analytics.

## Notification Engine: 
Schedules and dispatches push notification queues via APNs and Firebase Cloud Messaging (FCM).

## Subscription & Billing Service: 
Manages Freemium logic (Free Tier vs. Paid Tier) integrated with Stripe/App Store webhooks.

# 3. Database & Storage Layer (Supabase / PostgreSQL)
## Supabase PostgreSQL Database: 
Relational database utilizing Row-Level Security (RLS) to enforce data isolation per user.

## Supabase Object Storage: 
CDN-cached bucket hosting lightweight 3D/2D animation assets, thumbnail previews, and media files for exercise routines.

## Core feature database schema:

Label	        Primary Columns	                                            Feature Mapping
users	        id, email, phone, role, auth_type, is_active	            Account & Security (Admin capabilities)
health_profiles	user_id, age, affected_areas, limitations, medical_notes	Health Profile
exercises	    id, title, animation_url, is_premium, target_sensors	    Exercise Tracking & Animations
plans	        id, patient_id, schedule_days, exercise_ids	                Plans (Schedule)
exercise_logs   id, user_id, exercise_id, completed_at, telemetry_data	    Diagram/Analytics Generation
subscriptions   id, user_id, tier, stripe_sub_id, expires_at	            Cheap Monthly Freemium Model