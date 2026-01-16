class RideRequest {
  final String id;
  final String rideId;
  final String riderId;
  final String riderName;
  final String status; // 'pending', 'accepted', 'rejected'
  final DateTime createdAt;

  RideRequest({
    required this.id,
    required this.rideId,
    required this.riderId,
    required this.riderName,
    required this.status,
    required this.createdAt,
  });

  factory RideRequest.fromJson(Map<String, dynamic> json) {
    return RideRequest(
      id: json['id'] as String,
      rideId: json['rideId'] as String,
      riderId: json['riderId'] as String,
      riderName: json['riderName'] as String,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'rideId': rideId,
      'riderId': riderId,
      'riderName': riderName,
      'status': status,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}
