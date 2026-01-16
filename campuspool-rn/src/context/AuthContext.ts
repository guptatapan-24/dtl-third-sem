import React from 'react';

export const AuthContext = React.createContext({
  signIn: async (email: string, password: string) => {},
  signUp: async (email: string, password: string, name: string, role: string) => {},
  signOut: async () => {},
  user: null as any,
});
