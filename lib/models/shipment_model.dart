import 'package:cloud_firestore/cloud_firestore.dart';

/// Model representing a shipment document in `shipments` collection.
class ShipmentModel {
  final String shipmentId;
  final String orderId;
  final String orderReference;
  final String customerId;
  final String transporterId;
  final String transporterName;
  final String lrNumber;
  final String lrDocumentUrl;
  final String vehicleNumber;
  final String driverName;
  final String driverPhone;
  final Map<String, dynamic> pickupLocation;
  final Map<String, dynamic> deliveryLocation;
  final double totalWeightTons;
  final int totalBoxes;
  final double freightCharges;
  final String paymentTerms;
  final String shipmentStatus; // unassigned, assigned, dispatched, delivered, in_transit
  final DateTime? dispatchDate;
  final DateTime? estimatedDeliveryDate;
  final DateTime? actualDeliveryDate;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const ShipmentModel({
    required this.shipmentId,
    required this.orderId,
    required this.orderReference,
    required this.customerId,
    this.transporterId = '',
    this.transporterName = '',
    this.lrNumber = '',
    this.lrDocumentUrl = '',
    this.vehicleNumber = '',
    this.driverName = '',
    this.driverPhone = '',
    this.pickupLocation = const {},
    this.deliveryLocation = const {},
    this.totalWeightTons = 0.0,
    this.totalBoxes = 0,
    this.freightCharges = 0.0,
    this.paymentTerms = 'to_pay',
    this.shipmentStatus = 'unassigned',
    this.dispatchDate,
    this.estimatedDeliveryDate,
    this.actualDeliveryDate,
    this.createdAt,
    this.updatedAt,
  });

  String get id => shipmentId;

  static DateTime? _parseDate(dynamic val) {
    if (val is Timestamp) return val.toDate();
    if (val is String) return DateTime.tryParse(val);
    return null;
  }

  Map<String, dynamic> toMap() {
    return {
      'shipmentId': shipmentId,
      'id': shipmentId,
      'orderId': orderId,
      'orderReference': orderReference,
      'customerId': customerId,
      'transporterId': transporterId,
      'transporterName': transporterName,
      'lrNumber': lrNumber,
      'lrDocumentUrl': lrDocumentUrl,
      'vehicleNumber': vehicleNumber,
      'driverName': driverName,
      'driverPhone': driverPhone,
      'pickupLocation': pickupLocation,
      'deliveryLocation': deliveryLocation,
      'totalWeightTons': totalWeightTons,
      'totalBoxes': totalBoxes,
      'freightCharges': freightCharges,
      'paymentTerms': paymentTerms,
      'shipmentStatus': shipmentStatus,
      'dispatchDate': dispatchDate != null ? Timestamp.fromDate(dispatchDate!) : null,
      'estimatedDeliveryDate':
          estimatedDeliveryDate != null ? Timestamp.fromDate(estimatedDeliveryDate!) : null,
      'actualDeliveryDate':
          actualDeliveryDate != null ? Timestamp.fromDate(actualDeliveryDate!) : null,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory ShipmentModel.fromMap(Map<String, dynamic> map, [String? docId]) {
    final sId = map['shipmentId'] ?? map['id'] ?? docId ?? '';
    final pickup = map['pickupLocation'] is Map
        ? Map<String, dynamic>.from(map['pickupLocation'])
        : {'address': map['pickupLocation']?.toString() ?? ''};
    final delivery = map['deliveryLocation'] is Map
        ? Map<String, dynamic>.from(map['deliveryLocation'])
        : {'address': map['deliveryLocation']?.toString() ?? ''};

    return ShipmentModel(
      shipmentId: sId,
      orderId: map['orderId'] ?? '',
      orderReference: map['orderReference'] ?? '',
      customerId: map['customerId'] ?? map['userId'] ?? '',
      transporterId: map['transporterId'] ?? '',
      transporterName: map['transporterName'] ?? '',
      lrNumber: map['lrNumber'] ?? '',
      lrDocumentUrl: map['lrDocumentUrl'] ?? '',
      vehicleNumber: map['vehicleNumber'] ?? '',
      driverName: map['driverName'] ?? '',
      driverPhone: map['driverPhone'] ?? '',
      pickupLocation: pickup,
      deliveryLocation: delivery,
      totalWeightTons: (map['totalWeightTons'] ?? 0.0).toDouble(),
      totalBoxes: (map['totalBoxes'] ?? 0).toInt(),
      freightCharges: (map['freightCharges'] ?? 0.0).toDouble(),
      paymentTerms: map['paymentTerms'] ?? 'to_pay',
      shipmentStatus: map['shipmentStatus'] ?? map['dispatchStatus'] ?? 'unassigned',
      dispatchDate: _parseDate(map['dispatchDate']),
      estimatedDeliveryDate: _parseDate(map['estimatedDeliveryDate']),
      actualDeliveryDate: _parseDate(map['actualDeliveryDate']),
      createdAt: _parseDate(map['createdAt']),
      updatedAt: _parseDate(map['updatedAt']),
    );
  }

  ShipmentModel copyWith({
    String? shipmentId,
    String? orderId,
    String? orderReference,
    String? customerId,
    String? transporterId,
    String? transporterName,
    String? lrNumber,
    String? lrDocumentUrl,
    String? vehicleNumber,
    String? driverName,
    String? driverPhone,
    Map<String, dynamic>? pickupLocation,
    Map<String, dynamic>? deliveryLocation,
    double? totalWeightTons,
    int? totalBoxes,
    double? freightCharges,
    String? paymentTerms,
    String? shipmentStatus,
    DateTime? dispatchDate,
    DateTime? estimatedDeliveryDate,
    DateTime? actualDeliveryDate,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return ShipmentModel(
      shipmentId: shipmentId ?? this.shipmentId,
      orderId: orderId ?? this.orderId,
      orderReference: orderReference ?? this.orderReference,
      customerId: customerId ?? this.customerId,
      transporterId: transporterId ?? this.transporterId,
      transporterName: transporterName ?? this.transporterName,
      lrNumber: lrNumber ?? this.lrNumber,
      lrDocumentUrl: lrDocumentUrl ?? this.lrDocumentUrl,
      vehicleNumber: vehicleNumber ?? this.vehicleNumber,
      driverName: driverName ?? this.driverName,
      driverPhone: driverPhone ?? this.driverPhone,
      pickupLocation: pickupLocation ?? this.pickupLocation,
      deliveryLocation: deliveryLocation ?? this.deliveryLocation,
      totalWeightTons: totalWeightTons ?? this.totalWeightTons,
      totalBoxes: totalBoxes ?? this.totalBoxes,
      freightCharges: freightCharges ?? this.freightCharges,
      paymentTerms: paymentTerms ?? this.paymentTerms,
      shipmentStatus: shipmentStatus ?? this.shipmentStatus,
      dispatchDate: dispatchDate ?? this.dispatchDate,
      estimatedDeliveryDate: estimatedDeliveryDate ?? this.estimatedDeliveryDate,
      actualDeliveryDate: actualDeliveryDate ?? this.actualDeliveryDate,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
