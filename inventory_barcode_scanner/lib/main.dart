import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'services/api_service.dart';

void main() {
  runApp(const InventoryBarcodeApp());
}

class InventoryBarcodeApp extends StatelessWidget {
  const InventoryBarcodeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Inventory Barcode Scanner',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const AppWrapper(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class AppWrapper extends StatefulWidget {
  const AppWrapper({super.key});

  @override
  State<AppWrapper> createState() => _AppWrapperState();
}

class _AppWrapperState extends State<AppWrapper> {
  final ApiService _apiService = ApiService();
  Map<String, dynamic>? _user;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    try {
      final userData = await _apiService.getUserData();
      if (userData != null) {
        setState(() {
          _user = userData;
        });
      }
    } catch (e) {
      print('Error checking auth status: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _handleLoginSuccess(Map<String, dynamic> user) {
    setState(() {
      _user = user;
    });
  }

  Future<void> _handleLogout() async {
    await _apiService.logout();
    setState(() {
      _user = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_user == null) {
      return LoginScreen(onLoginSuccess: _handleLoginSuccess);
    }

    return HomeScreen(
      user: _user!,
      onLogout: _handleLogout,
    );
  }
}