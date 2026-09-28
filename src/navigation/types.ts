export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export type RootStackParamList = {
  Dashboard: undefined;
  Home: undefined; // demo exercise list from the prototype
  Exercise: { exerciseId: string };
  Complete: { exerciseId: string; reps: number };
};
