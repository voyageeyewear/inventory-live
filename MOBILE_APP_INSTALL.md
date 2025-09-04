# 📱 Inventory Scanner Mobile App - Installation Guide

## 🎉 **APK Ready for Installation!**

Your Flutter-based inventory barcode scanner app has been successfully built and is ready to install on your Android device.

### 📁 **APK Location**
```
/Users/ssenterprises/Inventory System/InventoryScanner.apk
```
**File Size:** 59MB

---

## 📲 **Installation Steps**

### **Method 1: Direct Transfer (Recommended)**

1. **Connect your Android device** to your computer via USB
2. **Enable USB File Transfer** on your phone
3. **Copy the APK** to your phone:
   ```bash
   # From your computer, copy the APK to your phone's Downloads folder
   cp "/Users/ssenterprises/Inventory System/InventoryScanner.apk" /path/to/phone/Downloads/
   ```
4. **On your Android device:**
   - Open **File Manager** or **Downloads** app
   - Find **InventoryScanner.apk**
   - Tap to install
   - Allow "Install from Unknown Sources" if prompted

### **Method 2: Email/Cloud Transfer**

1. **Email the APK** to yourself or upload to Google Drive/Dropbox
2. **Download on your phone** from email/cloud
3. **Install** as described above

### **Method 3: ADB Install (Technical)**

If you have ADB installed:
```bash
adb install "/Users/ssenterprises/Inventory System/InventoryScanner.apk"
```

---

## ⚙️ **Setup Instructions**

### **1. Enable Unknown Sources**
- Go to **Settings** → **Security** → **Unknown Sources** → **Enable**
- Or **Settings** → **Apps** → **Special Access** → **Install Unknown Apps** → **Allow**

### **2. Grant Permissions**
When you first open the app, grant these permissions:
- ✅ **Camera** (for barcode scanning)
- ✅ **Internet** (for API connection)
- ✅ **Vibration** (for scan feedback)

### **3. Network Configuration**
The app is configured to connect to: `http://192.168.0.111:8080`

**Make sure:**
- Your inventory system is running on your computer
- Your phone is connected to the same WiFi network
- Your computer's IP address is `192.168.0.111` (or update the app)

---

## 🔧 **App Features**

### **📷 Barcode Scanner**
- Real-time camera scanning
- Supports multiple barcode formats (EAN, UPC, Code128, etc.)
- Flash/torch support for low-light conditions
- Vibration feedback on successful scan

### **🔐 Authentication**
- Secure login with your inventory system credentials
- **Demo Login:** username: `admin`, password: `admin123`
- Automatic session management

### **📦 Stock Management**
- **Stock In:** Add inventory when receiving products
- **Stock Out:** Remove inventory when selling/using products
- Real-time quantity validation
- Optional transaction notes

### **🔄 Real-time Sync**
- All transactions sync instantly with your main inventory system
- Works with your existing web dashboard
- Updates Shopify stores automatically

---

## 🧪 **Testing the App**

### **1. Test Login**
- Open the app
- Use demo credentials: `admin` / `admin123`
- Should connect to your inventory system

### **2. Test Barcode Scanning**
- Tap "Start Barcode Scan"
- Point camera at your barcode: `116006FMG7026`
- Should find the test product we created

### **3. Test Stock Transaction**
- After scanning, choose "Stock In" or "Stock Out"
- Adjust quantity and add notes
- Process the transaction
- Check your web dashboard to confirm the update

---

## 🔍 **Troubleshooting**

### **Installation Issues**
- **"App not installed"**: Enable Unknown Sources in Settings
- **"Parse error"**: Re-download the APK, file may be corrupted
- **"Insufficient storage"**: Free up at least 100MB space

### **Connection Issues**
- **"Network error"**: Check WiFi connection and IP address
- **"Login failed"**: Verify inventory system is running on port 8080
- **"Product not found"**: Ensure the SKU exists in your inventory

### **Camera Issues**
- **"Camera permission denied"**: Go to App Settings → Permissions → Camera → Allow
- **"Barcode not scanning"**: Ensure good lighting and hold steady
- **"Camera not working"**: Restart the app or check camera permissions

### **Performance Issues**
- **App crashes**: Restart the app and check available RAM
- **Slow scanning**: Close other apps to free up resources
- **Battery drain**: Normal for camera-intensive apps

---

## 📱 **Device Requirements**

- **Android 5.0+** (API level 21+)
- **Camera** with autofocus
- **Internet connection** (WiFi recommended)
- **50MB+ free storage**
- **RAM:** 2GB+ recommended

---

## 🔄 **Updates**

To update the app:
1. Build a new APK with `flutter build apk --release`
2. Uninstall the old version from your phone
3. Install the new APK following the same steps

---

## 📞 **Support**

If you encounter issues:
1. Check this troubleshooting guide
2. Verify your inventory system is running properly
3. Ensure both devices are on the same network
4. Check the app logs for error messages

---

## 🎯 **Next Steps**

1. **Install the APK** on your Android device
2. **Test the barcode scanning** with your products
3. **Train your team** on using the mobile app
4. **Monitor performance** and gather feedback
5. **Scale up** by installing on multiple devices

Your complete inventory management system now includes:
- 🖥️ **Web Dashboard** (localhost:3000)
- 🔧 **Backend API** (localhost:8080)
- 📱 **Mobile Scanner App** (InventoryScanner.apk)

All components work together seamlessly! 🚀
