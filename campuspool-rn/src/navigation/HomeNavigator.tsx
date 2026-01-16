import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

import BrowseRidesScreen from '../screens/rides/BrowseRidesScreen';
import PostRideScreen from '../screens/rides/PostRideScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();

const HomeNavigator = () => {
  const { user } = useContext(AuthContext);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#999',
      }}
    >
      {user?.role === 'driver' && (
        <Tab.Screen
          name="PostRide"
          component={PostRideScreen}
          options={{
            title: 'Post Ride',
            tabBarLabel: 'Post Ride',
          }}
        />
      )}
      <Tab.Screen
        name="Browse"
        component={BrowseRidesScreen}
        options={{
          title: 'Browse Rides',
          tabBarLabel: 'Browse',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

export default HomeNavigator;
