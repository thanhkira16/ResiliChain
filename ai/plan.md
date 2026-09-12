# Weather Agent — LangGraph + Open-Meteo

## Mục tiêu

Nhận tên thành phố và/hoặc tọa độ, sau đó trả về thời tiết hiện tại của vị trí đó. Hệ thống dùng **LangGraph** để điều phối luồng xử lý và hai API công khai của **Open-Meteo**, nên không cần API key.

## API đã triển khai

`POST /api/ai/weather`

Body có thể dùng tên thành phố, tọa độ, hoặc cả hai. Khi tọa độ xuất hiện, chúng là giá trị được ưu tiên để tránh kết quả geocoding mơ hồ.

```json
{
  "city": "Hồ Chí Minh",
  "latitude": 10.8231,
  "longitude": 106.6297
}
```

Ví dụ chỉ dùng tên thành phố:

```json
{ "city": "Đà Nẵng" }
```

Kết quả thành công:

```json
{
  "success": true,
  "data": {
    "location": { "name": "Hồ Chí Minh", "latitude": 10.8231, "longitude": 106.6297 },
    "observedAt": "2026-09-12T11:00",
    "timezone": "Asia/Ho_Chi_Minh",
    "condition": "Có mây rải rác",
    "temperatureC": 30.2,
    "apparentTemperatureC": 35.1,
    "humidityPercent": 74,
    "precipitationMm": 0,
    "cloudCoverPercent": 43,
    "windSpeedKmh": 9.4,
    "windDirectionDegrees": 212,
    "isDay": true,
    "source": "Open-Meteo"
  }
}
```

## Luồng LangGraph

```text
START
  -> normaliseInput      (kiểm tra tên/tọa độ và giới hạn địa lý)
  -> resolveLocation     (dùng tọa độ, hoặc gọi Open-Meteo Geocoding)
  -> fetchWeather        (gọi Open-Meteo Forecast với dữ liệu current)
  -> END
```

Mỗi lỗi đầu vào, không tìm thấy thành phố, timeout, hoặc lỗi upstream đều dừng luồng và trả JSON lỗi có mã HTTP phù hợp. Timeout cho mỗi cuộc gọi công khai là 8 giây.

## Nguồn dữ liệu

- Geocoding: `https://geocoding-api.open-meteo.com/v1/search`
- Weather: `https://api.open-meteo.com/v1/forecast`

Mã thời tiết WMO của Open-Meteo được ánh xạ sang mô tả tiếng Việt trong `ai/weatherGraph.ts`.

## Hiển thị thời tiết tuyến đường trên bản đồ

`POST /api/ai/weather/route` nhận `cities` (2–10 thành phố), chạy Weather Agent LangGraph cho từng điểm dừng và cho phép từng lỗi riêng lẻ thay vì bỏ toàn bộ tuyến.

Giao diện bản đồ nhận tuyến theo định dạng `Cần Thơ → TP. Hồ Chí Minh → Đà Nẵng`. Mỗi điểm dừng được vẽ trên **bản đồ thế giới tương tác Leaflet + OpenStreetMap** bằng marker thời tiết và một tuyến nét đứt nối các điểm theo thứ tự nhập.

| Mức | Màu | Điều kiện chính |
|---|---|---|
| Nguy hiểm | Đỏ | Dông/mưa đá/mưa to, gió ≥ 50 km/h |
| Thời tiết xấu | Cam | Mưa vừa, sương mù, mưa rào, gió ≥ 30 km/h |
| Cần theo dõi | Vàng | Mưa nhẹ hoặc gió ≥ 20 km/h |
| Ổn định | Xanh | Điều kiện còn lại |
