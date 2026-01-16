import React, { useState, useContext } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import supabase from '../services/supabaseClient';
import { AuthContext } from '../context/AuthContext';

const PostRideScreen = () => {
  const { user } = useContext(AuthContext);
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [seats, setSeats] = useState('');
  const [cost, setCost] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePostRide = async () => {
    if (!source || !destination || !date || !time || !seats || !cost) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const departureTime = new Date(`${date}T${time}`).toISOString();

      const { error } = await supabase.from('rides').insert([
        {
          driver_id: user?.id,
          source,
          destination,
          departure_time: departureTime,
          total_seats: parseInt(seats),
          available_seats: parseInt(seats),
          estimated_cost: parseFloat(cost),
          status: 'posted',
        },
      ]);

      if (error) throw error;

      Alert.alert('Success', 'Ride posted successfully!');
      setSource('');
      setDestination('');
      setDate('');
      setTime('');
      setSeats('');
      setCost('');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Post a Ride</Text>

      <TextInput
        style={styles.input}
        placeholder="Pickup Location"
        placeholderTextColor="#999"
        value={source}
        onChangeText={setSource}
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Destination"
        placeholderTextColor="#999"
        value={destination}
        onChangeText={setDestination}
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Date (YYYY-MM-DD)"
        placeholderTextColor="#999"
        value={date}
        onChangeText={setDate}
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Time (HH:MM)"
        placeholderTextColor="#999"
        value={time}
        onChangeText={setTime}
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Available Seats"
        placeholderTextColor="#999"
        value={seats}
        onChangeText={setSeats}
        keyboardType="numeric"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Estimated Total Cost ($)"
        placeholderTextColor="#999"
        value={cost}
        onChangeText={setCost}
        keyboardType="decimal-pad"
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handlePostRide}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Post Ride</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
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
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
    color: '#000',
  },
  button: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PostRideScreen;
