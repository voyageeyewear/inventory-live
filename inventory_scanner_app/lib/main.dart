import 'package:flutter/material.dart';
import 'services/api_service.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/scanner_screen.dart';
import 'screens/stock_transaction_screen.dart';

void main() {
  runApp(const InventoryScannerApp());
}

class InventoryScannerApp extends StatelessWidget {
  const InventoryScannerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Inventory Scanner',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const MainScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  final ApiService _apiService = ApiService();
  
  Map<String, dynamic>? _user;
  String _currentScreen = 'home'; // 'home', 'scanner', 'transaction'
  Map<String, dynamic>? _scannedProduct;
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
      _currentScreen = 'home';
      _scannedProduct = null;
    });
  }

  void _handleStartScan() {
    setState(() {
      _currentScreen = 'scanner';
    });
  }

  void _handleProductFound(Map<String, dynamic> product) {
    setState(() {
      _scannedProduct = product;
      _currentScreen = 'transaction';
    });
  }

  void _handleBackToHome() {
    setState(() {
      _currentScreen = 'home';
      _scannedProduct = null;
    });
  }

  void _handleBackToScanner() {
    setState(() {
      _currentScreen = 'scanner';
      _scannedProduct = null;
    });
  }

  void _handleTransactionSuccess() {
    setState(() {
      _currentScreen = 'home';
      _scannedProduct = null;
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

    // Render current screen based on state
    switch (_currentScreen) {
      case 'scanner':
        return ScannerScreen(
          onProductFound: _handleProductFound,
          onBack: _handleBackToHome,
        );
      case 'transaction':
        return _scannedProduct != null
            ? StockTransactionScreen(
                product: _scannedProduct!,
                onBack: _handleBackToScanner,
                onSuccess: _handleTransactionSuccess,
              )
            : HomeScreen(
                user: _user!,
                onStartScan: _handleStartScan,
                onLogout: _handleLogout,
              );
      default:
        return HomeScreen(
          user: _user!,
          onStartScan: _handleStartScan,
          onLogout: _handleLogout,
        );
    }
  }
}