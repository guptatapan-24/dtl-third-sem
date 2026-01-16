class Ride {
  final String id;
  final String driverId;
  final String driverName;
  final String source;
  final String destination;
  final DateTime departureTime;
  final int totalSeats;
  final int availableSeats;
  final double estimatedCost;
  final String status; // 'posted', 'in_progress', 'completed'
  final DateTime createdAt;

  Ride({
    required this.id,
    required this.driverId,
    required this.driverName,
    required this.source,
    required this.destination,
    required this.departureTime,
    required this.totalSeats,
    required this.availableSeats,
    required this.estimatedCost,
    required this.status,
    required this.createdAt,
  });

  factory Ride.fromJson(Map<String, dynamic> json) {
    return Ride(
      id: json['id'] as String,
      driverId: json['driverId'] as String,
      driverName: json['driverName'] as String,
      source: json['source'] as String,
      destination: json['destination'] as String,
      departureTime: DateTime.parse(json['departureTime'] as String),
      totalSeats: json['totalSeats'] as int,
      availableSeats: json['availableSeats'] as int,
      estimatedCost: (json['estimatedCost'] as num).toDouble(),
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'driverId': driverId,
      'driverName': driverName,
      'source': source,
      'destination': destination,
      'departureTime': departureTime.toIso8601String(),
      'totalSeats': totalSeats,
      'availableSeats': availableSeats,
      'estimatedCost': estimatedCost,
      'status': status,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  double get costPerRider {
    final bookedSeats = totalSeats - availableSeats;
    if (bookedSeats == 0) return estimatedCost;
    return estimatedCost / bookedSeats;
  }
}
