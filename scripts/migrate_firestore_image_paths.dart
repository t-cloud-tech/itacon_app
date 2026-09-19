/// Safe, Non-Destructive Migration Script for Firestore Product Image Paths.
///
/// Converts legacy local asset paths to clean Firebase Storage paths:
/// - 'assets/images/tiles/...' -> 'products/tiles/...'
/// - 'assets/images/mockups/...' -> 'products/mockups/...'
/// - 'assets/images/adhesives/...' -> 'products/adhesives/...'
///
/// IMPORTANT:
/// Per Phase 3 requirements, this script is provided for future reference
/// and MUST NOT be executed destructively during Phase 3.
/// Default mode is DRY RUN (read-only audit).
library;

import 'dart:io';

String convertPath(String path) {
  if (path.startsWith('assets/images/tiles/')) {
    return path.replaceFirst('assets/images/tiles/', 'products/tiles/');
  }
  if (path.startsWith('assets/images/mockups/')) {
    return path.replaceFirst('assets/images/mockups/', 'products/mockups/');
  }
  if (path.startsWith('assets/images/adhesives/')) {
    return path.replaceFirst('assets/images/adhesives/', 'products/adhesives/');
  }
  if (path.startsWith('assets/adhesives/')) {
    return path.replaceFirst('assets/adhesives/', 'products/adhesives/');
  }
  return path;
}

List<String> convertPaths(List<dynamic>? paths) {
  if (paths == null) return [];
  return paths.map((p) => convertPath(p.toString())).toList();
}

Map<String, dynamic> migrateDocumentData(Map<String, dynamic> data) {
  final updated = Map<String, dynamic>.from(data);

  if (updated['images'] is List) {
    updated['images'] = convertPaths(updated['images'] as List);
  }
  if (updated['faceImages'] is List) {
    updated['faceImages'] = convertPaths(updated['faceImages'] as List);
  }
  if (updated['mockupImages'] is List) {
    updated['mockupImages'] = convertPaths(updated['mockupImages'] as List);
  }
  if (updated['lifestyleImages'] is List) {
    updated['lifestyleImages'] = convertPaths(updated['lifestyleImages'] as List);
  }
  if (updated['imageUrl'] is String) {
    updated['imageUrl'] = convertPath(updated['imageUrl'] as String);
  }

  return updated;
}

void main(List<String> args) {
  final isDryRun = !args.contains('--execute');
  stdout.writeln('====================================================');
  stdout.writeln('FIRESTORE IMAGE PATH MIGRATION TOOL');
  stdout.writeln('Mode: ${isDryRun ? "DRY-RUN (Safe / Read-Only)" : "EXECUTE"}');
  stdout.writeln('====================================================');

  if (isDryRun) {
    stdout.writeln('Dry-run mode active. No documents will be modified.');
    stdout.writeln('To execute, pass --execute explicitly after user approval.');
  } else {
    stdout.writeln('WARNING: Execution mode requested. STOP AND VERIFY before proceeding.');
  }
}
