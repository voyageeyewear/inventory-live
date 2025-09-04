import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Update this with your computer's IP address
  static const String baseUrl = 'http://192.168.0.27:8080';
  
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
      final url = '$baseUrl/api/auth/login';
      print('🔐 Login URL: $url');
      print('👤 Username: $username');
      
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'username': username,
          'password': password,
        }),
      );
      
      print('📡 Login Response Status: ${response.statusCode}');
      print('📄 Login Response Body: ${response.body}');
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          await setAuthToken(data['data']['token']);
          await setUserData(data['data']['user']);
          print('✅ Login successful, token saved');
        }
        return data;
      } else {
        print('❌ Login failed: ${response.statusCode}');
        return {
          'success': false,
          'message': 'Login failed: ${response.statusCode}',
        };
      }
    } catch (e) {
      print('🚨 Login Exception: $e');
      return {
        'success': false,
        'message': 'Network error: $e',
      };
    }
  }
  
  // Logout
  Future<void> logout() async {
    await removeAuthToken();
    await removeUserData();
  }
  
  // Get headers with auth token
  Future<Map<String, String>> getHeaders() async {
    final token = await getAuthToken();
    final headers = {'Content-Type': 'application/json'};
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
      print('🔑 Using auth token: ${token.substring(0, 20)}...');
    } else {
      print('⚠️ No auth token found');
    }
    return headers;
  }
  
  // Search product by SKU
  Future<Map<String, dynamic>> searchProductBySku(String sku) async {
    try {
      final headers = await getHeaders();
      final url = '$baseUrl/api/products?search=${Uri.encodeComponent(sku)}';
      print('🔍 API Call: $url');
      print('📋 Headers: $headers');
      
      final response = await http.get(
        Uri.parse(url),
        headers: headers,
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Request timeout - server not responding');
        },
      );
      
      print('📡 Response Status: ${response.statusCode}');
      print('📄 Response Body Length: ${response.body.length}');
      print('📄 Response Body: ${response.body.substring(0, response.body.length > 200 ? 200 : response.body.length)}');
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        print('✅ API Success: Found ${data.length} products');
        return {
          'success': true,
          'data': data,
        };
      } else {
        print('❌ API Error: ${response.statusCode} - ${response.body}');
        return {
          'success': false,
          'message': 'HTTP ${response.statusCode}: ${response.body}',
        };
      }
    } catch (e) {
      print('🚨 Network Exception: $e');
      String errorMessage = 'Network error: $e';
      
      // Provide more specific error messages
      if (e.toString().contains('timeout')) {
        errorMessage = 'Request timeout - check network connection';
      } else if (e.toString().contains('SocketException')) {
        errorMessage = 'Cannot connect to server - check network and server status';
      } else if (e.toString().contains('HandshakeException')) {
        errorMessage = 'SSL/TLS connection failed';
      }
      
      return {
        'success': false,
        'message': errorMessage,
      };
    }
  }
  
  // Test connectivity
  Future<Map<String, dynamic>> testConnectivity() async {
    try {
      final url = '$baseUrl/api/health';
      print('🏥 Testing connectivity: $url');
      
      final response = await http.get(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
      ).timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          throw Exception('Health check timeout');
        },
      );
      
      print('🏥 Health check response: ${response.statusCode}');
      
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
      print('🚨 Connectivity test failed: $e');
      return {
        'success': false,
        'message': 'Cannot reach server: $e',
      };
    }
  }
  
  // Stock In
  Future<Map<String, dynamic>> stockIn(String sku, int quantity, String notes) async {
    try {
      final headers = await getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/api/stock/in'),
        headers: headers,
        body: json.encode({
          'sku': sku,
          'quantity': quantity,
          'notes': notes.isEmpty ? 'Mobile barcode scan - Stock In' : notes,
        }),
      );
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {
          'success': true,
          'data': data,
        };
      } else {
        return {
          'success': false,
          'message': 'Stock in failed: ${response.statusCode}',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Network error: $e',
      };
    }
  }
  
  // Stock Out
  Future<Map<String, dynamic>> stockOut(String sku, int quantity, String notes) async {
    try {
      final headers = await getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/api/stock/out'),
        headers: headers,
        body: json.encode({
          'sku': sku,
          'quantity': quantity,
          'notes': notes.isEmpty ? 'Mobile barcode scan - Stock Out' : notes,
        }),
      );
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return {
          'success': true,
          'data': data,
        };
      } else {
        return {
          'success': false,
          'message': 'Stock out failed: ${response.statusCode}',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Network error: $e',
      };
    }
  }
  
  // Log Scan
  Future<Map<String, dynamic>> logScan(String sku) async {
    try {
      final headers = await getHeaders();
      final url = '$baseUrl/api/scan-logs';
      print('📝 Logging scan: $url');
      
      final response = await http.post(
        Uri.parse(url),
        headers: headers,
        body: json.encode({
          'sku': sku,
          'session_id': 'mobile-session',
        }),
      );
      
      print('📡 Scan Log Response Status: ${response.statusCode}');
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        print('✅ Scan logged successfully');
        return {
          'success': true,
          'data': data,
        };
      } else {
        print('❌ Scan log failed: ${response.statusCode} - ${response.body}');
        return {
          'success': false,
          'message': 'Failed to log scan: ${response.statusCode}',
        };
      }
    } catch (e) {
      print('🚨 Scan Log Exception: $e');
      return {
        'success': false,
        'message': 'Network error: $e',
      };
    }
  }
}
