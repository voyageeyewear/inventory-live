import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:vibration/vibration.dart';
import '../services/api_service.dart';

class ScannerScreen extends StatefulWidget {
  final Function(Map<String, dynamic>) onProductFound;
  final VoidCallback onBack;
  
  const ScannerScreen({
    Key? key, 
    required this.onProductFound,
    required this.onBack,
  }) : super(key: key);

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final MobileScannerController _controller = MobileScannerController();
  final ApiService _apiService = ApiService();
  bool _isScanning = true;
  bool _isLoading = false;
  String? _scannedCode;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) async {
    if (!_isScanning || _isLoading) return;
    
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;
    
    final barcode = barcodes.first;
    final String? code = barcode.rawValue;
    
    if (code == null || code.isEmpty) return;
    
    setState(() {
      _isScanning = false;
      _isLoading = true;
      _scannedCode = code;
    });
    
    // Vibrate on scan
    if (await Vibration.hasVibrator() ?? false) {
      Vibration.vibrate(duration: 100);
    }
    
    await _lookupProduct(code);
  }

  Future<void> _lookupProduct(String sku) async {
    try {
      // First test connectivity
      print('🔍 Looking up product: $sku');
      final connectivityTest = await _apiService.testConnectivity();
      if (!connectivityTest['success']) {
        _showErrorDialog('Connection Failed', connectivityTest['message']);
        return;
      }
      print('✅ Connectivity test passed');
      
      final result = await _apiService.searchProductBySku(sku);
      
      if (result['success'] == true) {
        final data = result['data'];
        
        // Backend returns products array directly
        List<dynamic> products = [];
        if (data is List) {
          products = data;
        } else {
          // Fallback for unexpected response format
          products = [];
        }
        
        // Find exact SKU match
        Map<String, dynamic>? product;
        for (var p in products) {
          try {
            if (p is Map<String, dynamic> && 
                p['sku'] != null && 
                p['sku'].toString().toLowerCase() == sku.toLowerCase()) {
              product = p;
              break;
            }
          } catch (e) {
            print('⚠️ Error processing product: $e');
            continue;
          }
        }
        
        if (product != null) {
          // Log the scan to the backend
          _logScan(sku);
          widget.onProductFound(product);
        } else {
          _showProductNotFoundDialog(sku);
        }
      } else {
        _showErrorDialog('Lookup Failed', result['message'] ?? 'Failed to lookup product');
      }
    } catch (e) {
      _showErrorDialog('Network Error', 'Failed to lookup product: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _logScan(String sku) async {
    try {
      await _apiService.logScan(sku);
      // Don't show any UI feedback for scan logging to keep it seamless
    } catch (e) {
      print('Failed to log scan: $e');
      // Silently fail - don't interrupt the user experience
    }
  }

  void _showProductNotFoundDialog(String sku) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Product Not Found'),
        content: Text('No product found with SKU: $sku'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _resetScanning();
            },
            child: const Text('Scan Again'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              widget.onBack();
            },
            child: const Text('Go Back'),
          ),
        ],
      ),
    );
  }

  void _showErrorDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _resetScanning();
            },
            child: const Text('Try Again'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              widget.onBack();
            },
            child: const Text('Go Back'),
          ),
        ],
      ),
    );
  }

  void _resetScanning() {
    setState(() {
      _isScanning = true;
      _isLoading = false;
      _scannedCode = null;
    });
  }

  void _toggleFlash() {
    _controller.toggleTorch();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera View
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          
          // Overlay
          Column(
            children: [
              // Top overlay
              Expanded(
                flex: 1,
                child: Container(
                  color: Colors.black.withOpacity(0.6),
                  child: SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Column(
                        children: [
                          // Header
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              // Back button
                              GestureDetector(
                                onTap: widget.onBack,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.arrow_back, 
                                           color: Colors.white, 
                                           size: 20),
                                      SizedBox(width: 4),
                                      Text(
                                        'Back',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              
                              // Flash button
                              GestureDetector(
                                onTap: _toggleFlash,
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: const Icon(
                                    Icons.flash_on,
                                    color: Colors.white,
                                    size: 24,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          
                          const Spacer(),
                          
                          // Instructions
                          const Text(
                            'Point your camera at a barcode to scan',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w500,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              
              // Scanning area
              SizedBox(
                height: 200,
                child: Center(
                  child: Container(
                    width: MediaQuery.of(context).size.width * 0.8,
                    height: 150,
                    child: Stack(
                      children: [
                        // Corner indicators
                        Positioned(
                          top: 0,
                          left: 0,
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: const BoxDecoration(
                              border: Border(
                                top: BorderSide(color: Colors.green, width: 3),
                                left: BorderSide(color: Colors.green, width: 3),
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          top: 0,
                          right: 0,
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: const BoxDecoration(
                              border: Border(
                                top: BorderSide(color: Colors.green, width: 3),
                                right: BorderSide(color: Colors.green, width: 3),
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 0,
                          left: 0,
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: const BoxDecoration(
                              border: Border(
                                bottom: BorderSide(color: Colors.green, width: 3),
                                left: BorderSide(color: Colors.green, width: 3),
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: const BoxDecoration(
                              border: Border(
                                bottom: BorderSide(color: Colors.green, width: 3),
                                right: BorderSide(color: Colors.green, width: 3),
                              ),
                            ),
                          ),
                        ),
                        
                        // Scanning line
                        if (_isScanning && !_isLoading)
                          Positioned(
                            top: 75,
                            left: 0,
                            right: 0,
                            child: Container(
                              height: 2,
                              color: Colors.green,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              
              // Bottom overlay
              Expanded(
                flex: 1,
                child: Container(
                  color: Colors.black.withOpacity(0.6),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (_isLoading) ...[
                          const CircularProgressIndicator(color: Colors.white),
                          const SizedBox(height: 16),
                          const Text(
                            'Looking up product...',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                            ),
                          ),
                        ] else if (_scannedCode != null && !_isScanning) ...[
                          ElevatedButton(
                            onPressed: _resetScanning,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.blue[600],
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 24,
                                vertical: 12,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(25),
                              ),
                            ),
                            child: const Text(
                              'Scan Again',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        
                        if (_scannedCode != null) ...[
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.green.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.green),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.check_circle, 
                                           color: Colors.green, 
                                           size: 20),
                                const SizedBox(width: 8),
                                const Text(
                                  'Scanned: ',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                Text(
                                  _scannedCode!,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontFamily: 'monospace',
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
