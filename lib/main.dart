import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'services/firestore_service.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    debugPrint('Firebase initialization note: $e');
  }
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Itacon App',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const FirebaseTestScreen(),
    );
  }
}

class FirebaseTestScreen extends StatefulWidget {
  const FirebaseTestScreen({super.key});

  @override
  State<FirebaseTestScreen> createState() => _FirebaseTestScreenState();
}

class _FirebaseTestScreenState extends State<FirebaseTestScreen> {
  final FirestoreService _firestoreService = FirestoreService();
  bool _isLoading = false;
  String? _statusMessage;
  Map<String, dynamic>? _savedUserData;

  Future<void> _storeTestUserInFirebase() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      // Step 1: Write document to Firebase Cloud Firestore
      await _firestoreService.createUserProfile(
        uid: 'TEST_USER_001',
        phoneNumber: '+919876543210',
        fullName: 'Test Customer',
        role: 'dealer',
        assignedSalespersonId: null,
        isVerified: false,
      );

      // Step 2: Read document back from Firebase to verify storage
      final fetchedData =
          await _firestoreService.getUserProfile('TEST_USER_001');

      setState(() {
        _savedUserData = fetchedData;
        _statusMessage =
            'Successfully saved and verified TEST_USER_001 in Firebase Database!';
      });
    } catch (e) {
      setState(() {
        _statusMessage = 'Error storing in Firebase: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Firebase Firestore Test'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.storage_rounded,
                size: 64,
                color: Colors.deepPurple,
              ),
              const SizedBox(height: 16),
              const Text(
                'Test 1: Verify users Collection Schema',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Document ID: TEST_USER_001\nRole: dealer | Phone: +919876543210',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _isLoading ? null : _storeTestUserInFirebase,
                icon: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.cloud_upload),
                label: Text(
                  _isLoading
                      ? 'Saving to Firebase...'
                      : 'Store Document in Firebase Database',
                ),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 14,
                  ),
                ),
              ),
              if (_statusMessage != null) ...[
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _statusMessage!.startsWith('Error')
                        ? Colors.red.shade50
                        : Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _statusMessage!.startsWith('Error')
                          ? Colors.red
                          : Colors.green,
                    ),
                  ),
                  child: Text(
                    _statusMessage!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: _statusMessage!.startsWith('Error')
                          ? Colors.red.shade900
                          : Colors.green.shade900,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
              if (_savedUserData != null) ...[
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Text(
                      'Stored Document Content:\n${_savedUserData.toString()}',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
