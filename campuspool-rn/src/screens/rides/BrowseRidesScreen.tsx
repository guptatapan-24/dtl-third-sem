import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import supabase from '../services/supabaseClient';

const BrowseRidesScreen = () => {
  const [rides, setRides] = useState([]);
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRides();
  }, []);

  const fetchRides = async (filter?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('rides')
        .select('*')
        .eq('status', 'posted');

      if (filter) {
        query = query.ilike('destination', `%${filter}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRides(data || []);
    } catch (error) {
      console.error('Error fetching rides:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find Rides</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Filter by destination"
        placeholderTextColor="#999"
        value={destination}
        onChangeText={(text) => {
          setDestination(text);
          fetchRides(text);
        }}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
      ) : rides.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No rides available</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.rideCard}>
              <Text style={styles.routeText}>
                {item.source} → {item.destination}
              </Text>
              <Text style={styles.detailText}>
                Time: {new Date(item.departure_time).toLocaleString()}
              </Text>
              <Text style={styles.detailText}>
                Available Seats: {item.available_seats}
              </Text>
              <Text style={styles.costText}>
                ${(item.estimated_cost / item.total_seats).toFixed(2)} per seat
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 14,
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  rideCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  costText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    marginTop: 8,
  },
});

export default BrowseRidesScreen;
