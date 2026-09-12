# 02. ĐẮC TẢ ĐỘNG CƠ ĐÁNH GIÁ RỦI RO (RISK ASSESSMENT ENGINE & 3 WEATHER APIS)

## 1. Công Thức Tính Điểm Rủi Ro Chuẩn Backend (`RiskBreakdownDto`)

Điểm rủi ro trễ hạn `delayRiskScore` (thang từ $0$ đến $100$) trong `IncidentDto` được AI Engine tính toán theo công thức đặc tả của Backend:

$$\text{delayRiskScore} = \text{round}\left(100 \cdot \left( w_1 \cdot \text{latenessFactor} + w_2 \cdot \text{supplierReliabilityFactor} + w_3 \cdot \text{inventoryBufferFactor} \right)\right)$$

Trong đó:
- **Trọng số mặc định**: $w_1 = 0.50$, $w_2 = 0.25$, $w_3 = 0.25$ (Tổng bằng $1.0$).

---

## 2. Chi Tiết Các Cấu Phần Tính Toán (Enrichment Engine)

### 2.1 `latenessFactor` (Tỷ lệ trễ hạn đã chuẩn hóa $[0, 1]$)

$$\text{latenessFactor} = \min\left(1.0, \frac{\text{delayDays} + \text{weatherDelayForecast}}{\text{promisedLeadTimeDays}}\right)$$

* `delayDays`: Số ngày chậm trễ hiện tại giữa `promisedDeliveryDate` và `actualOrExpectedDeliveryDate`.
* `weatherDelayForecast`: Số ngày dự báo bị chậm thêm do bão/thời tiết cực đoan được AI quét từ **3 Weather APIs**.

### 2.2 `supplierReliabilityFactor` (Tỷ lệ rủi ro uy tín nhà cung cấp $[0, 1]$)

$$\text{supplierReliabilityFactor} = \max\left(0.0, \min\left(1.0, 1.0 - \frac{\text{adjustedReliabilityScore}}{100}\right)\right)$$

$$\text{adjustedReliabilityScore} = \text{reliabilityScore}_{base} - \text{Penalty}_{FMP\_Fin} - \text{Penalty}_{GDELT\_News}$$

* **Penalty từ FMP API (Altman Z-Score)**:
  - $Z > 2.99$ (An toàn): $\text{Penalty} = 0$
  - $1.81 \le Z \le 2.99$ (Cảnh báo): $\text{Penalty} = 15$
  - $Z < 1.81$ (Nguy cơ phá sản): $\text{Penalty} = 35$
* **Penalty từ GDELT API (Tin tức địa chính trị/đình công/đứt gãy)**:
  - Sentiment Score âm nặng ($< -5.0$) hoặc tin tức đình công/thiên tai: $\text{Penalty} = 20$.

### 2.3 `inventoryBufferFactor` (Tỷ lệ thiếu hụt tồn kho an toàn $[0, 1]$)

$$\text{inventoryBufferFactor} = \max\left(0.0, \min\left(1.0, 1.0 - \frac{\text{currentStock}}{\text{safetyStock}}\right)\right)$$

---

## 3. Quy Trình Quét Thời Tiết & Geocoding Với Open-Meteo APIs (`transitWaypoints`)

Mỗi đơn hàng chứa mảng `transitWaypoints` gồm các điểm dừng và tọa độ GPS (`latitude`, `longitude`) hoặc tên địa danh (`location_name`). AI Worker sử dụng bộ công cụ miễn phí **Open-Meteo API** (không cần API Key) để giải mã tọa độ và dự báo thời tiết tuyến:

```
[ transitWaypoints Array (Địa danh / GPS) ]
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ 1. Open-Meteo Geocoding API                           │
│ - URL: https://geocoding-api.open-meteo.com/v1/search  │
│ - Tự động tra cứu lat/lon nếu địa danh chưa có tọa độ  │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ 2. Open-Meteo Weather Forecast API                     │
│ - URL: https://api.open-meteo.com/v1/forecast          │
│ - Lấy WMO Weather Codes, Wind Speed/Gusts, Rain/Snow   │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ 3. Weather Risk Evaluator (apidata/open_meteo_weather) │
│ - Đánh giá mã thời tiết WMO 4677 & tốc độ gió (>50km/h) │
│ - Dự báo số ngày trễ weatherDelayForecast (+0 đến +7d)  │
└────────────────────────────────────────────────────────┘
```

### 3.1 Quy Đổi Rủi Ro Thời Tiết Open-Meteo:

1. **Open-Meteo Geocoding API** (Free, no-key):
   * URL: `https://geocoding-api.open-meteo.com/v1/search?name={query}&count=1&language=en&format=json`
   * Chức năng: Tìm kiếm tọa độ GPS chính xác từ tên cảng, kho bãi hoặc địa danh (vd: "Long Beach", "Kho Cát Lái").
2. **Open-Meteo Weather Forecast API** (Free, no-key):
   * URL: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=weather_code,wind_speed_10m,wind_gusts_10m,precipitation&daily=precipitation_sum,wind_speed_10m_max`
   * **Mã thời tiết WMO 4677**:
     * Code 65 (Mưa to), 75 (Tuyết rơi dày), 82 (Mưa rào lớn): Phạt trễ $+3 \rightarrow +5$ ngày.
     * Code 95, 96, 99 (Dông bão, mưa đá): Phạt trễ $+4 \rightarrow +7$ ngày.
   * **Tốc độ gió & Gió giật**: Tốc độ gió $> 50$ km/h hoặc gió giật $> 65$ km/h (nguy cơ dừng cẩu bãi cảng hoặc cấm xe công-tai-nơ) $\rightarrow$ Phạt trễ tối thiểu $+3$ ngày.
   * **Lượng mưa ngày**: Mưa tích tụ $> 50$ mm/ngày $\rightarrow$ Phạt trễ $+2$ ngày do ngập lụt/sạt lở.

---

## 4. Ví Dụ Tính Toán Chi Tiết (Numeric Walkthrough)

Giả sử đơn hàng `PO-2026-003`:
* `promisedLeadTimeDays` = 14 ngày, `delayDays` = 10 ngày.
* Quét thời tiết 3 APIs phát hiện bão tại `latitude: 10.365`, dự báo trễ thêm `weatherDelayForecast` = +3 ngày $\rightarrow$ Tổng trễ = 13 ngày.
* `latenessFactor` = $\min(1.0, 13 / 14) = 0.929$.
* `reliabilityScore` gốc = 88. FMP API phát hiện Altman Z-Score = 2.1 (Penalty = 15) $\rightarrow$ `adjustedReliabilityScore` = $88 - 15 = 73$.
* `supplierReliabilityFactor` = $1.0 - 73/100 = 0.27$.
* `currentStock` = 38, `safetyStock` = 80 $\rightarrow$ `inventoryBufferFactor` = $1.0 - 38/80 = 0.525$.

### Kết quả tính `delayRiskScore`:
$$\text{Score} = (0.50 \cdot 0.929) + (0.25 \cdot 0.27) + (0.25 \cdot 0.525) = 0.4645 + 0.0675 + 0.13125 = 0.66325 \longrightarrow 66/100$$
Vượt ngưỡng cảnh báo $65/100 \longrightarrow$ Tự động tạo `IncidentDto` trạng thái `PENDING_APPROVAL`.
