import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../rides/browse_rides_screen.dart';
import '../rides/post_ride_screen.dart';
import '../profile/profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    late final List<Widget> screens;

    if (user?.role == 'driver') {
      screens = [
        const PostRideScreen(),
        const BrowseRidesScreen(),
        const ProfileScreen(),
      ];
    } else {
      screens = [
        const BrowseRidesScreen(),
        const ProfileScreen(),
      ];
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('CampusPool'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              context.read<AuthProvider>().logout();
            },
          ),
        ],
      ),
      body: screens[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        items: user?.role == 'driver'
            ? [
                const BottomNavigationBarItem(
                  icon: Icon(Icons.add_circle_outline),
                  label: 'Post Ride',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.directions_car),
                  label: 'Browse',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.person),
                  label: 'Profile',
                ),
              ]
            : [
                const BottomNavigationBarItem(
                  icon: Icon(Icons.directions_car),
                  label: 'Browse',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.person),
                  label: 'Profile',
                ),
              ],
      ),
    );
  }
}
