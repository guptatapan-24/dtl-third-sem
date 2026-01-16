import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import { AuthContext } from './src/context/AuthContext';
import supabase from './src/services/supabaseClient';

import LoginScreen from './src/screens/auth/LoginScreen';
import SignupScreen from './src/screens/auth/SignupScreen';
import SplashScreen from './src/screens/SplashScreen';
import HomeNavigator from './src/navigation/HomeNavigator';

const Stack = createStackNavigator();

const App = () => {
  const [state, dispatch] = React.useReducer(
    (prevState: any, action: any) => {
      switch (action.type) {
        case 'RESTORE_TOKEN':
          return {
            ...prevState,
            userToken: action.token,
            isLoading: false,
          };
        case 'SIGN_IN':
          return {
            ...prevState,
            isSignout: false,
            userToken: action.token,
            user: action.user,
          };
        case 'SIGN_OUT':
          return {
            ...prevState,
            isSignout: true,
            userToken: null,
            user: null,
          };
      }
    },
    {
      isLoading: true,
      isSignout: false,
      userToken: null,
      user: null,
    }
  );

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          dispatch({
            type: 'RESTORE_TOKEN',
            token: session.access_token,
          });
        } else {
          dispatch({ type: 'RESTORE_TOKEN', token: null });
        }
      } catch (e) {
        dispatch({ type: 'RESTORE_TOKEN', token: null });
      }
    };

    bootstrapAsync();
  }, []);

  const authContext = React.useMemo(
    () => ({
      signIn: async (email: string, password: string) => {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;

          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user?.id)
            .single();

          dispatch({
            type: 'SIGN_IN',
            token: data.session?.access_token,
            user: userData,
          });
        } catch (error: any) {
          throw new Error(error.message);
        }
      },
      signUp: async (
        email: string,
        password: string,
        name: string,
        role: string
      ) => {
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });

          if (error) throw error;

          const { error: insertError } = await supabase.from('users').insert([
            {
              id: data.user?.id,
              email,
              name,
              role,
            },
          ]);

          if (insertError) throw insertError;

          dispatch({
            type: 'SIGN_IN',
            token: data.session?.access_token,
            user: { id: data.user?.id, email, name, role },
          });
        } catch (error: any) {
          throw new Error(error.message);
        }
      },
      signOut: async () => {
        try {
          await supabase.auth.signOut();
          dispatch({ type: 'SIGN_OUT' });
        } catch (error: any) {
          throw new Error(error.message);
        }
      },
    }),
    []
  );

  if (state.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ ...authContext, user: state.user }}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animationEnabled: true,
          }}
        >
          {state.userToken == null ? (
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{
                  animationTypeForReplace: state.isSignout ? 'pop' : 'default',
                }}
              />
              <Stack.Screen
                name="Signup"
                component={SignupScreen}
                options={{
                  presentation: 'modal',
                }}
              />
            </>
          ) : (
            <Stack.Screen name="Home" component={HomeNavigator} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
};

export default App;
