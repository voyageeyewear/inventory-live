import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'https://local-inventory-management-system-5acygvdq8.vercel.app';
  
  // Get stored auth token
  Future<String?> getAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('auth_token');
  }
  
  // Store auth token
  Future<void> setAuthToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', token);
  }
  
  // Remove auth token
  Future<void> removeAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  }
  
  // Get stored user data
  Future<Map<String, dynamic>?> getUserData() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString('user_data');
    if (userJson != null) {
      return json.decode(userJson);
    }
    return null;
  }
  
  // Store user data
  Future<void> setUserData(Map<String, dynamic> userData) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_data', json.encode(userData));
  }
  
  // Remove user data
  Future<void> removeUserData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user_data');
  }
  
  // Login
  Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      print('🔐 Attempting login to: $baseUrl/api/auth/login');
      print('👤 Username: $username');
      
      final response = await http.post(
        Uri.parse('$baseUrl/api/auth/login'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: json.encode({
          'username': username,
          'password': password,
        }),
      ).timeout(const Duration(seconds: 15));
      
      print('📡 Response Status: ${response.statusCode}');
      print('📄 Response Body: ${response.body}');
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        if (data['success'] == true) {
          // Store token and user data
          await setAuthToken(data['token']);
          await setUserData(data['user']);
          print('✅ Login successful');
          
          return {
            'success': true,
            'message': 'Login successful',
            'user': data['user'],
          };
        } else {
          return {
            'success': false,
            'message': data['message'] ?? 'Login failed',
          };
        }
      } else {
        return {
          'success': false,
          'message': 'Server error: ${response.statusCode}',
        };
      }
    } catch (e) {
      print('🚨 Login error: $e');
      return {
        'success': false,
        'message': 'Connection error: ${e.toString()}',
      };
    }
  }
  
  // Logout
  Future<void> logout() async {
    await removeAuthToken();
    await removeUserData();
  }
  
  // Search product by SKU
  Future<Map<String, dynamic>> searchProductBySku(String sku) async {
    try {
      final token = await getAuthToken();
      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }
      
      print('🔍 Searching for SKU: $sku');
      
      final response = await http.get(
        Uri.parse('$baseUrl/api/products?search=${Uri.encodeComponent(sku)}'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 10));
      
      print('📡 Search Response: ${response.statusCode}');
      print('📄 Search Body: ${response.body}');
      
      if (response.statusCode == 200) {
        final products = json.decode(response.body);
        if (products is List && products.isNotEmpty) {
          // Find exact SKU match
          final exactMatch = products.firstWhere(
            (product) => product['sku'].toString().toLowerCase() == sku.toLowerCase(),
            orElse: () => products.first,
          );
          
          return {
            'success': true,
            'product': exactMatch,
          };
        } else {
          return {
            'success': false,
            'message': 'Product not found',
          };
        }
      } else {
        return {
          'success': false,
          'message': 'Search failed: ${response.statusCode}',
        };
      }
    } catch (e) {
      print('🚨 Search error: $e');
      return {
        'success': false,
        'message': 'Search error: ${e.toString()}',
      };
    }
  }
  
  // Submit stock transaction for approval
  Future<Map<String, dynamic>> submitStockTransaction({
    required String sku,
    required String transactionType, // 'stock_in' or 'stock_out'
    required int quantity,
    String notes = '',
  }) async {
    try {
      final token = await getAuthToken();
      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }
      
      print('📦 Submitting transaction: $transactionType $quantity for $sku');
      
      final response = await http.post(
        Uri.parse('$baseUrl/api/mobile-transactions'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'sku': sku,
          'transaction_type': transactionType,
          'quantity': quantity,
          'notes': notes,
        }),
      ).timeout(const Duration(seconds: 15));
      
      print('📡 Transaction Response: ${response.statusCode}');
      print('📄 Transaction Body: ${response.body}');
      
      if (response.statusCode == 201 || response.statusCode == 200) {
        final data = json.decode(response.body);
        return {
          'success': true,
          'message': data['message'] ?? 'Transaction submitted for approval',
          'data': data['data'],
        };
      } else {
        final errorData = json.decode(response.body);
        return {
          'success': false,
          'message': errorData['message'] ?? 'Transaction failed',
        };
      }
    } catch (e) {
      print('🚨 Transaction error: $e');
      return {
        'success': false,
        'message': 'Transaction error: ${e.toString()}',
      };
    }
  }
  
  // Test connectivity
  Future<Map<String, dynamic>> testConnectivity() async {
    try {
      print('🏥 Testing connectivity to: $baseUrl/api/health');
      
      final response = await http.get(
        Uri.parse('$baseUrl/api/health'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 10));
      
      print('🏥 Health Response: ${response.statusCode}');
      
      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': 'Server is reachable',
        };
      } else {
        return {
          'success': false,
          'message': 'Server returned ${response.statusCode}',
        };
      }
    } catch (e) {
      print('🚨 Connectivity error: $e');
      return {
        'success': false,
        'message': 'Cannot reach server: ${e.toString()}',
      };
    }
  }
}
