export type RootStackParamList = {
  Home: undefined;
  Exercise: { exerciseId: string };
  Complete: { exerciseId: string; reps: number };
};
