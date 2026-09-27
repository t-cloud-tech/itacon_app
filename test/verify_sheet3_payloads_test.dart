import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_product.dart';

void main() {
  test('Verify all 97 Sheet 3 proposed Firestore payloads parse cleanly in TileProduct', () {
    final file = File('build/sheet3_dry_run_payloads.json');
    expect(file.existsSync(), isTrue);

    final jsonContent = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    final docs = (jsonContent['allProposedDocuments'] as List).cast<Map<String, dynamic>>();

    expect(docs.length, equals(97));

    int parsedCount = 0;
    for (final doc in docs) {
      final docId = doc['id'] as String;
      final product = TileProduct.fromMap(doc, docId);

      expect(product.id, equals(docId));
      expect(product.sku, startsWith('VIT-60120-8.50-GLO-MAR-WHIT-'));
      expect(product.name.isNotEmpty, isTrue);
      expect(product.basePrice, greaterThan(0));
      expect(product.moq, greaterThan(0));
      expect(product.resolvedMockupImages.isNotEmpty, isTrue);
      expect(product.resolvedFaceImages.isNotEmpty, isTrue);
      expect(product.frontCardImage.isNotEmpty, isTrue);
      expect(product.frontCardThumbnail.isNotEmpty, isTrue);

      parsedCount++;
    }

    expect(parsedCount, equals(97));
    stdout.writeln('Successfully parsed all 97 Sheet 3 products into TileProduct models without errors!');
  });
}
