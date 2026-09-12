# 03. ĐẮC TẢ CÔNG THỨC TOÁN HỌC & CLEAN PURE FUNCTIONS (`src/core/formulas.py`)

Toàn bộ các công thức rủi ro được tách thành các hàm thuần túy (Pure Functions) tại `ai/src/core/formulas.py`:

---

## 1. Công Thức Điểm Rủi Ro Trễ Hạn Đơn Hàng (`delayRiskScore`)

$$\text{delayRiskScore} = \text{round}\left(100 \cdot \left( w_1 \cdot \text{latenessFactor} + w_2 \cdot \text{supplierReliabilityFactor} + w_3 \cdot \text{inventoryBufferFactor} \right)\right)$$

- **Trọng số mặc định**: $w_1 = 0.50$, $w_2 = 0.25$, $w_3 = 0.25$.

### 1.1 `latenessFactor`:
$$\text{latenessFactor} = \min\left(1.0, \frac{\text{delayDays} + \text{weatherDelayForecast}}{\text{promisedLeadTimeDays}}\right)$$

### 1.2 `supplierReliabilityFactor`:
$$\text{adjustedReliabilityScore} = \text{reliabilityScore}_{\text{base}} - \text{Penalty}_{\text{FMP\_Fin}} - \text{Penalty}_{\text{GDELT\_News}}$$
$$\text{supplierReliabilityFactor} = \max\left(0.0, \min\left(1.0, 1.0 - \frac{\text{adjustedReliabilityScore}}{100}\right)\right)$$

### 1.3 `inventoryBufferFactor`:
$$\text{inventoryBufferFactor} = \max\left(0.0, \min\left(1.0, 1.0 - \frac{\text{currentStock}}{\text{safetyStock}}\right)\right)$$

---

## 2. Công Thức Sức Khỏe Tài Chính (Altman Z-Score) & $SSI_{\text{fin}}$

$$Z = 1.2 X_1 + 1.4 X_2 + 3.3 X_3 + 0.6 X_4 + 0.999 X_5$$

Trong đó:
- $X_1 = \text{WorkingCapital} / \text{TotalAssets}$
- $X_2 = \text{RetainedEarnings} / \text{TotalAssets}$
- $X_3 = \text{EBIT} / \text{TotalAssets}$
- $X_4 = \text{MarketCap} / \text{TotalLiabilities}$
- $X_5 = \text{Revenue} / \text{TotalAssets}$

- **Diễn giải vùng**: $Z \le 1.81$ (Distress / Nguy cơ), $1.81 < Z < 2.99$ (Grey / Cảnh báo), $Z \ge 2.99$ (Safe / An toàn).

---

## 3. Công Thức Chỉ Số $PORS$ Cho Nhà Cung Ứng

$$PORS = 0.35 \cdot SSI_{\text{news}} + 0.30 \cdot SSI_{\text{fin}} + 0.20 \cdot SSI_{\text{del}} + 0.15 \cdot G_{\text{geo}}$$

- **Điều kiện kích hoạt sự cố**: $PORS \ge 70 \longrightarrow \text{Kích hoạt Email & Đề xuất phương án thay thế!}$

---

## 4. Công Thức Chấm Điểm PuLP MILP Solver Chọn Đối Tác Thay Thế

$$\text{Score}_i = \text{round}\left(0.45 \cdot \text{CostScore}_i + 0.35 \cdot \text{LeadTimeScore}_i + 0.20 \cdot \text{ReliabilityScore}_i\right)$$
