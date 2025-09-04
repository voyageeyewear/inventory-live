import 'package:flutter/material.dart';
import '../services/api_service.dart';

class StockTransactionScreen extends StatefulWidget {
  final Map<String, dynamic> product;
  final VoidCallback onBack;
  final VoidCallback onSuccess;
  
  const StockTransactionScreen({
    Key? key,
    required this.product,
    required this.onBack,
    required this.onSuccess,
  }) : super(key: key);

  @override
  State<StockTransactionScreen> createState() => _StockTransactionScreenState();
}

class _StockTransactionScreenState extends State<StockTransactionScreen> {
  final ApiService _apiService = ApiService();
  final TextEditingController _notesController = TextEditingController();
  
  String _transactionType = 'in'; // 'in' or 'out'
  int _quantity = 1;
  bool _isLoading = false;

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  int get _currentStock => int.tryParse(widget.product['quantity'].toString()) ?? 0;
  int get _newStock => _transactionType == 'in' 
      ? _currentStock + _quantity 
      : _currentStock - _quantity;

  Future<void> _processTransaction() async {
    if (_quantity <= 0) {
      _showErrorDialog('Invalid Quantity', 'Please enter a valid quantity greater than 0');
      return;
    }

    if (_transactionType == 'out' && _quantity > _currentStock) {
      _showErrorDialog(
        'Insufficient Stock',
        'Cannot remove $_quantity items. Only $_currentStock available.',
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final result = _transactionType == 'in'
          ? await _apiService.stockIn(
              widget.product['sku'],
              _quantity,
              _notesController.text,
            )
          : await _apiService.stockOut(
              widget.product['sku'],
              _quantity,
              _notesController.text,
            );

      if (result['success'] == true) {
        _showSuccessDialog();
      } else {
        _showErrorDialog('Transaction Failed', result['message'] ?? 'Failed to process transaction');
      }
    } catch (e) {
      _showErrorDialog('Network Error', 'Failed to process transaction: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Success'),
        content: Text(
          'Successfully processed ${_transactionType == 'in' ? 'stock-in' : 'stock-out'} for ${widget.product['product_name']}',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              widget.onSuccess();
            },
            child: const Text('OK'),
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
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('Stock Transaction'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: widget.onBack,
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Product Info Card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.product['product_name'] ?? 'Unknown Product',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildDetailRow('SKU:', widget.product['sku'] ?? 'N/A'),
                    _buildDetailRow('Current Stock:', '$_currentStock', 
                                   valueColor: Colors.green[600]),
                    _buildDetailRow('Price:', '\$${widget.product['price']?.toString() ?? '0.00'}'),
                    _buildDetailRow('Category:', widget.product['category'] ?? 'N/A'),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Transaction Type
            const Text(
              'Transaction Type',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildTypeButton(
                    'Stock In',
                    Icons.add_box,
                    'in',
                    Colors.green,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTypeButton(
                    'Stock Out',
                    Icons.remove_circle,
                    'out',
                    Colors.red,
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 24),
            
            // Quantity
            const Text(
              'Quantity',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 12),
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(4.0),
                child: Row(
                  children: [
                    _buildQuantityButton(Icons.remove, () {
                      if (_quantity > 1) {
                        setState(() {
                          _quantity--;
                        });
                      }
                    }),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Text(
                          '$_quantity',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                    _buildQuantityButton(Icons.add, () {
                      setState(() {
                        _quantity++;
                      });
                    }),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Stock Preview
            const Text(
              'Stock Preview',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 12),
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    _buildPreviewRow('Current Stock:', '$_currentStock'),
                    _buildPreviewRow(
                      '${_transactionType == 'in' ? 'Adding:' : 'Removing:'}',
                      '${_transactionType == 'in' ? '+' : '-'}$_quantity',
                      valueColor: _transactionType == 'in' ? Colors.green : Colors.red,
                    ),
                    const Divider(),
                    _buildPreviewRow(
                      'New Stock:',
                      '$_newStock',
                      valueColor: _newStock < 0 ? Colors.red : Colors.green[600],
                      isTotal: true,
                    ),
                  ],
                ),
              ),
            ),
            
            if (_newStock < 0) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red[200]!),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning, color: Colors.red[600], size: 20),
                    const SizedBox(width: 8),
                    const Text(
                      'Insufficient stock for this transaction',
                      style: TextStyle(
                        color: Colors.red,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            
            const SizedBox(height: 24),
            
            // Notes
            const Text(
              'Notes (Optional)',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Add notes about this transaction...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            
            const SizedBox(height: 32),
            
            // Submit Button
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: (_isLoading || _newStock < 0) ? null : _processTransaction,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _transactionType == 'in' ? Colors.green[600] : Colors.red[600],
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Text(
                        'Process ${_transactionType == 'in' ? 'Stock In' : 'Stock Out'} ($_quantity units)',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: valueColor ?? Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypeButton(String label, IconData icon, String type, Color color) {
    final isSelected = _transactionType == type;
    return GestureDetector(
      onTap: () {
        setState(() {
          _transactionType = type;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.1) : Colors.white,
          border: Border.all(
            color: isSelected ? color : Colors.grey[300]!,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? color : Colors.grey[600],
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: isSelected ? color : Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuantityButton(IconData icon, VoidCallback onPressed) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
      ),
      child: IconButton(
        icon: Icon(icon),
        onPressed: onPressed,
        color: Colors.black87,
      ),
    );
  }

  Widget _buildPreviewRow(String label, String value, {Color? valueColor, bool isTotal = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isTotal ? 16 : 14,
              fontWeight: isTotal ? FontWeight.w600 : FontWeight.normal,
              color: isTotal ? Colors.black87 : Colors.grey[600],
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: isTotal ? 16 : 14,
              fontWeight: FontWeight.bold,
              color: valueColor ?? (isTotal ? Colors.black87 : Colors.black87),
            ),
          ),
        ],
      ),
    );
  }
}
