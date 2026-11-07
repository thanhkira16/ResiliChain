-- ============================================================================
--  ResiliChain - DEMO ERP SEED (hackathon)
--  File: ai/seed_demo_erp.sql
--
--  Seeds the ERP tables owned by the Backend so a fresh database can run the
--  full demo end to end:
--    suppliers, inventory_items, purchase_orders, shipments,
--    shipment_tracking_points
--
--  Story date: 2026-11-07. Ten real EV-supply-chain companies (same tickers the
--  AI worker tracks via GDELT + FMP). Prices are in VND.
--
--  Designed to feed ai/seed_ai_data.sql, which then computes risk scores and
--  creates incidents / proposals for the three headline cases:
--    PO-2026-011  Rivian  drive unit   -> sole alternative is Lucid (distressed)
--    PO-2026-009  TSMC    auto MCU     -> Taiwan Strait / Kaohsiung disruption
--    PO-2026-003  Ford    LFP cells    -> dangerous-goods hold, GM chosen
--
--  Idempotent: wipes and re-inserts the demo rows. DESTRUCTIVE for these
--  tables - do not run against a shared production database.
--  Run order:  just schema  ->  this file  ->  ai/seed_ai_data.sql
-- ============================================================================

BEGIN;

-- Clear dependents first (FK order).
DELETE FROM logistics_messages;
DELETE FROM logistics_conversations;
DELETE FROM risk_alerts;
DELETE FROM sourcing_proposals;
DELETE FROM incidents;
DELETE FROM supplier_risk_analysis;
DELETE FROM shipment_tracking_points;
DELETE FROM shipments;
DELETE FROM purchase_orders;
DELETE FROM inventory_items;
DELETE FROM suppliers;

-- ----------------------------------------------------------------------------
--  1. suppliers
-- ----------------------------------------------------------------------------
INSERT INTO suppliers (id, name, contact_person, email, phone, provided_skus,
                       average_lead_time_days, historical_price, reliability_score,
                       address, transit_waypoints)
VALUES
('SUP-01', 'Ford Motor', 'Daniel Brooks', 'ford.partner@resilichain.demo', '+1 270 555 0101',
 '["SKU-BAT-03"]', 30, '{"SKU-BAT-03": 9300000}', 72,
 'BlueOval SK Battery Park, Glendale, Kentucky, USA',
 '[{"orderIndex":1,"locationName":"BlueOval SK Kentucky","checkpointType":"OriginWarehouse","description":"Nhà máy cell pin LFP","estimatedHoursFromOrigin":0,"latitude":37.6020,"longitude":-85.9060},
   {"orderIndex":2,"locationName":"Memphis Rail Hub","checkpointType":"TransitHub","description":"Trung chuyển đường sắt BNSF","estimatedHoursFromOrigin":14,"latitude":35.1495,"longitude":-90.0490},
   {"orderIndex":3,"locationName":"Port of Long Beach","checkpointType":"TransitHub","description":"Cảng xuất khẩu bờ Tây","estimatedHoursFromOrigin":72,"latitude":33.7540,"longitude":-118.2160},
   {"orderIndex":4,"locationName":"Port of Busan","checkpointType":"TransitHub","description":"Chuyển tải hàng nguy hiểm loại 9","estimatedHoursFromOrigin":380,"latitude":35.1040,"longitude":129.0400},
   {"orderIndex":5,"locationName":"Cảng Lạch Huyện, Hải Phòng","checkpointType":"TransitHub","description":"Cảng nhập khẩu","estimatedHoursFromOrigin":500,"latitude":20.8330,"longitude":106.8900},
   {"orderIndex":6,"locationName":"Kho ResiliChain Hải Phòng","checkpointType":"DestinationWarehouse","description":"Kho linh kiện KCN Đình Vũ","estimatedHoursFromOrigin":506,"latitude":20.8410,"longitude":106.7700}]'),

('SUP-02', 'Lucid Motors', 'Priya Raman', 'lucid.partner@resilichain.demo', '+1 520 555 0102',
 '["SKU-MOT-09"]', 28, '{"SKU-MOT-09": 10303200}', 63,
 'Lucid AMP-1, Casa Grande, Arizona, USA',
 '[{"orderIndex":1,"locationName":"Lucid AMP-1 Casa Grande","checkpointType":"OriginWarehouse","description":"Nhà máy drive unit","estimatedHoursFromOrigin":0,"latitude":32.8500,"longitude":-111.7500},
   {"orderIndex":2,"locationName":"Port of Long Beach","checkpointType":"TransitHub","description":"Cảng xuất khẩu bờ Tây","estimatedHoursFromOrigin":10,"latitude":33.7540,"longitude":-118.2160},
   {"orderIndex":3,"locationName":"Port of Yokohama","checkpointType":"TransitHub","description":"Chuyển tải xuyên Thái Bình Dương","estimatedHoursFromOrigin":300,"latitude":35.4440,"longitude":139.6380},
   {"orderIndex":4,"locationName":"Cảng Lạch Huyện, Hải Phòng","checkpointType":"TransitHub","description":"Cảng nhập khẩu","estimatedHoursFromOrigin":450,"latitude":20.8330,"longitude":106.8900},
   {"orderIndex":5,"locationName":"Kho ResiliChain Hải Phòng","checkpointType":"DestinationWarehouse","description":"Kho linh kiện KCN Đình Vũ","estimatedHoursFromOrigin":456,"latitude":20.8410,"longitude":106.7700}]'),

('SUP-03', 'Rivian', 'Marcus Hill', 'rivian.partner@resilichain.demo', '+1 309 555 0103',
 '["SKU-MOT-09"]', 27, '{"SKU-MOT-09": 10494000}', 68,
 'Rivian Manufacturing Plant, Normal, Illinois, USA',
 '[{"orderIndex":1,"locationName":"Rivian Normal Plant","checkpointType":"OriginWarehouse","description":"Nhà máy Enduro drive unit","estimatedHoursFromOrigin":0,"latitude":40.5140,"longitude":-89.0310},
   {"orderIndex":2,"locationName":"Chicago Intermodal Hub","checkpointType":"TransitHub","description":"Trung chuyển đường sắt","estimatedHoursFromOrigin":6,"latitude":41.8500,"longitude":-87.6500},
   {"orderIndex":3,"locationName":"Port of Long Beach","checkpointType":"TransitHub","description":"Cảng xuất khẩu bờ Tây","estimatedHoursFromOrigin":80,"latitude":33.7540,"longitude":-118.2160},
   {"orderIndex":4,"locationName":"Port of Yokohama","checkpointType":"TransitHub","description":"Chuyển tải xuyên Thái Bình Dương","estimatedHoursFromOrigin":370,"latitude":35.4440,"longitude":139.6380},
   {"orderIndex":5,"locationName":"Cảng Lạch Huyện, Hải Phòng","checkpointType":"TransitHub","description":"Cảng nhập khẩu","estimatedHoursFromOrigin":520,"latitude":20.8330,"longitude":106.8900},
   {"orderIndex":6,"locationName":"Kho ResiliChain Hải Phòng","checkpointType":"DestinationWarehouse","description":"Kho linh kiện KCN Đình Vũ","estimatedHoursFromOrigin":526,"latitude":20.8410,"longitude":106.7700}]'),

('SUP-04', 'General Motors', 'Laura Chen', 'gm.partner@resilichain.demo', '+1 330 555 0104',
 '["SKU-BAT-03", "SKU-BAT-05"]', 30, '{"SKU-BAT-03": 9439500, "SKU-BAT-05": 9120000}', 76,
 'Ultium Cells, Warren, Ohio, USA',
 '[{"orderIndex":1,"locationName":"Ultium Cells Warren","checkpointType":"OriginWarehouse","description":"Nhà máy cell NCMA","estimatedHoursFromOrigin":0,"latitude":41.1700,"longitude":-80.8600},
   {"orderIndex":2,"locationName":"Port of Long Beach","checkpointType":"TransitHub","description":"Cảng xuất khẩu bờ Tây","estimatedHoursFromOrigin":84,"latitude":33.7540,"longitude":-118.2160},
   {"orderIndex":3,"locationName":"Port of Busan","checkpointType":"TransitHub","description":"Chuyển tải hàng nguy hiểm loại 9","estimatedHoursFromOrigin":390,"latitude":35.1040,"longitude":129.0400},
   {"orderIndex":4,"locationName":"Kho ResiliChain Hải Phòng","checkpointType":"DestinationWarehouse","description":"Kho linh kiện KCN Đình Vũ","estimatedHoursFromOrigin":520,"latitude":20.8410,"longitude":106.7700}]'),

('SUP-05', 'TSMC', 'Kevin Lin', 'tsmc.partner@resilichain.demo', '+886 3 555 0105',
 '["SKU-MCU-07"]', 35, '{"SKU-MCU-07": 1850000}', 88,
 'Hsinchu Science Park, Hsinchu, Taiwan',
 '[{"orderIndex":1,"locationName":"TSMC Fab 12, Hsinchu","checkpointType":"OriginWarehouse","description":"Foundry MCU 28nm","estimatedHoursFromOrigin":0,"latitude":24.7740,"longitude":121.0110},
   {"orderIndex":2,"locationName":"Port of Kaohsiung","checkpointType":"TransitHub","description":"Cảng xuất khẩu phía Nam Đài Loan","estimatedHoursFromOrigin":5,"latitude":22.6100,"longitude":120.2800},
   {"orderIndex":3,"locationName":"Eo biển Đài Loan","checkpointType":"TransitHub","description":"Tuyến feeder Kaohsiung - Hải Phòng","estimatedHoursFromOrigin":30,"latitude":22.0000,"longitude":118.5000},
   {"orderIndex":4,"locationName":"Cảng Lạch Huyện, Hải Phòng","checkpointType":"TransitHub","description":"Cảng nhập khẩu","estimatedHoursFromOrigin":96,"latitude":20.8330,"longitude":106.8900},
   {"orderIndex":5,"locationName":"Kho ResiliChain Hải Phòng","checkpointType":"DestinationWarehouse","description":"Kho linh kiện KCN Đình Vũ","estimatedHoursFromOrigin":102,"latitude":20.8410,"longitude":106.7700}]'),

('SUP-06', 'Tesla', 'Elena Novak', 'tesla.partner@resilichain.demo', '+1 775 555 0106',
 '["SKU-BAT-03", "SKU-BAT-04"]', 26, '{"SKU-BAT-03": 9746400, "SKU-BAT-04": 8950000}', 82,
 'Gigafactory Nevada, Sparks, Nevada, USA',
 '[{"orderIndex":1,"locationName":"Gigafactory Nevada","checkpointType":"OriginWarehouse","description":"Nhà máy cell 4680","estimatedHoursFromOrigin":0,"latitude":39.5380,"longitude":-119.4430},
   {"orderIndex":2,"locationName":"Port of Oakland","checkpointType":"TransitHub","description":"Cảng xuất khẩu bờ Tây","estimatedHoursFromOrigin":8,"latitude":37.7950,"longitude":-122.3200},
   {"orderIndex":3,"locationName":"Port of Busan","checkpointType":"TransitHub","description":"Chuyển tải hàng nguy hiểm loại 9","estimatedHoursFromOrigin":300,"latitude":35.1040,"longitude":129.0400},
   {"orderIndex":4,"locationName":"Cảng Lạch Huyện, Hải Phòng","checkpointType":"TransitHub","description":"Cảng nhập khẩu","estimatedHoursFromOrigin":420,"latitude":20.8330,"longitude":106.8900},
   {"orderIndex":5,"locationName":"Kho ResiliChain Hải Phòng","checkpointType":"DestinationWarehouse","description":"Kho linh kiện KCN Đình Vũ","estimatedHoursFromOrigin":426,"latitude":20.8410,"longitude":106.7700}]'),

('SUP-07', 'NVIDIA', 'Ryan Patel', 'nvidia.partner@resilichain.demo', '+1 408 555 0107',
 '["SKU-SOC-05"]', 35, '{"SKU-SOC-05": 28500000}', 90,
 '2788 San Tomas Expressway, Santa Clara, California, USA',
 '[{"orderIndex":1,"locationName":"NVIDIA Santa Clara","checkpointType":"OriginWarehouse","description":"Kho DRIVE Thor","estimatedHoursFromOrigin":0,"latitude":37.3700,"longitude":-121.9640},
   {"orderIndex":2,"locationName":"San Francisco Intl Airport (SFO)","checkpointType":"TransitHub","description":"Hàng không - hàng giá trị cao","estimatedHoursFromOrigin":4,"latitude":37.6210,"longitude":-122.3790},
   {"orderIndex":3,"locationName":"Sân bay Nội Bài","checkpointType":"TransitHub","description":"Thông quan hàng không","estimatedHoursFromOrigin":30,"latitude":21.2210,"longitude":105.8070},
   {"orderIndex":4,"locationName":"Kho ResiliChain Hải Phòng","checkpointType":"DestinationWarehouse","description":"Kho linh kiện KCN Đình Vũ","estimatedHoursFromOrigin":34,"latitude":20.8410,"longitude":106.7700}]'),

('SUP-08', 'Advanced Micro Devices', 'Sofia Martinez', 'amd.partner@resilichain.demo', '+1 408 555 0108',
 '["SKU-FPG-08"]', 30, '{"SKU-FPG-08": 4200000}', 86,
 '2100 Logic Drive, San Jose, California, USA',
 '[{"orderIndex":1,"locationName":"AMD Xilinx San Jose","checkpointType":"OriginWarehouse","description":"Kho FPGA ô tô","estimatedHoursFromOrigin":0,"latitude":37.2930,"longitude":-121.9280},
   {"orderIndex":2,"locationName":"Ted Stevens Anchorage Intl","checkpointType":"TransitHub","description":"Hub hàng không xuyên Thái Bình Dương","estimatedHoursFromOrigin":8,"latitude":61.1740,"longitude":-149.9960},
   {"orderIndex":3,"locationName":"Incheon Intl Airport","checkpointType":"TransitHub","description":"Chuyển tải hàng không","estimatedHoursFromOrigin":20,"latitude":37.4600,"longitude":126.4400},
   {"orderIndex":4,"locationName":"Sân bay Nội Bài","checkpointType":"TransitHub","description":"Thông quan hàng không","estimatedHoursFromOrigin":26,"latitude":21.2210,"longitude":105.8070},
   {"orderIndex":5,"locationName":"Kho ResiliChain Hải Phòng","checkpointType":"DestinationWarehouse","description":"Kho linh kiện KCN Đình Vũ","estimatedHoursFromOrigin":30,"latitude":20.8410,"longitude":106.7700}]'),

('SUP-09', 'Intel', 'James Walker', 'intel.partner@resilichain.demo', '+1 480 555 0109',
 '["SKU-ADS-06"]', 32, '{"SKU-ADS-06": 6800000}', 84,
 'Intel Ocotillo Campus, Chandler, Arizona, USA',
 '[{"orderIndex":1,"locationName":"Intel Ocotillo Chandler","checkpointType":"OriginWarehouse","description":"Kho Mobileye EyeQ","estimatedHoursFromOrigin":0,"latitude":33.2700,"longitude":-111.8900},
   {"orderIndex":2,"locationName":"Los Angeles Intl Airport (LAX)","checkpointType":"TransitHub","description":"Hàng không xuất khẩu","estimatedHoursFromOrigin":8,"latitude":33.9420,"longitude":-118.4080},
   {"orderIndex":3,"locationName":"Taoyuan Intl Airport","checkpointType":"TransitHub","description":"Chuyển tải hàng không","estimatedHoursFromOrigin":24,"latitude":25.0800,"longitude":121.2330},
   {"orderIndex":4,"locationName":"Sân bay Tân Sơn Nhất","checkpointType":"TransitHub","description":"Thông quan hàng không","estimatedHoursFromOrigin":30,"latitude":10.8180,"longitude":106.6520},
   {"orderIndex":5,"locationName":"Kho ResiliChain Bình Dương","checkpointType":"DestinationWarehouse","description":"Kho linh kiện VSIP","estimatedHoursFromOrigin":33,"latitude":10.9310,"longitude":106.7130}]'),

('SUP-10', 'Sony Group', 'Haruto Sato', 'sony.partner@resilichain.demo', '+81 96 555 0110',
 '["SKU-SEN-12"]', 30, '{"SKU-SEN-12": 1250000}', 89,
 'Sony Semiconductor Kumamoto TEC, Kikuyo, Kumamoto, Japan',
 '[{"orderIndex":1,"locationName":"Sony Semiconductor Kumamoto","checkpointType":"OriginWarehouse","description":"Nhà máy cảm biến CMOS","estimatedHoursFromOrigin":0,"latitude":32.8700,"longitude":130.7600},
   {"orderIndex":2,"locationName":"Hakata Port, Fukuoka","checkpointType":"TransitHub","description":"Cảng xuất khẩu","estimatedHoursFromOrigin":4,"latitude":33.6100,"longitude":130.4000},
   {"orderIndex":3,"locationName":"Biển Hoa Đông","checkpointType":"TransitHub","description":"Tuyến Fukuoka - Hải Phòng","estimatedHoursFromOrigin":40,"latitude":30.5000,"longitude":125.5000},
   {"orderIndex":4,"locationName":"Cảng Lạch Huyện, Hải Phòng","checkpointType":"TransitHub","description":"Cảng nhập khẩu","estimatedHoursFromOrigin":120,"latitude":20.8330,"longitude":106.8900},
   {"orderIndex":5,"locationName":"Kho ResiliChain Hải Phòng","checkpointType":"DestinationWarehouse","description":"Kho linh kiện KCN Đình Vũ","estimatedHoursFromOrigin":126,"latitude":20.8410,"longitude":106.7700}]');

-- historical_price is a price SERIES per SKU ({"SKU": [{date, unitPrice}]}),
-- as the AI contract expects. The values above are the latest price
-- (2026-09-01 mark); expand them into a 3-point quarterly series.
UPDATE suppliers s
SET historical_price = (
    SELECT jsonb_object_agg(kv.key, jsonb_build_array(
        jsonb_build_object('date', '2026-05-01', 'unitPrice', round(kv.value::numeric * 0.965)),
        jsonb_build_object('date', '2026-07-01', 'unitPrice', round(kv.value::numeric * 0.985)),
        jsonb_build_object('date', '2026-09-01', 'unitPrice', kv.value::numeric)))
    FROM jsonb_each_text(s.historical_price) AS kv);

-- ----------------------------------------------------------------------------
--  2. inventory_items
--     Stock levels are chosen so the three headline SKUs sit below safety stock.
-- ----------------------------------------------------------------------------
INSERT INTO inventory_items (sku, name, category, unit, current_stock, safety_stock,
                             weekly_burn_rate, unit_price_estimate, min_lead_time_days)
VALUES
('SKU-BAT-03', 'Cell pin LFP 48V (BlueOval SK)',          'Pin & BMS',  'module', 38,  80,  42, 9300000,  26),
('SKU-BAT-04', 'Cell pin 4680 cylindrical (Tesla)',       'Pin & BMS',  'module', 70,  100, 30, 8950000,  26),
('SKU-BAT-05', 'Cell pin NCMA Ultium',                    'Pin & BMS',  'module', 120, 90,  28, 9120000,  30),
('SKU-MOT-09', 'Enduro drive unit & inverter',            'Truyền động', 'bộ',     18,  40,  12, 10494000, 27),
('SKU-MCU-07', 'MCU ô tô 28nm (TSMC foundry)',            'Bán dẫn',    'chip',   260, 400, 150, 1850000, 35),
('SKU-SOC-05', 'NVIDIA DRIVE Thor SoC',                   'Bán dẫn',    'chip',   90,  60,  20, 28500000, 35),
('SKU-FPG-08', 'AMD Xilinx Automotive FPGA',              'Bán dẫn',    'chip',   150, 100, 25, 4200000,  30),
('SKU-ADS-06', 'Mobileye EyeQ6 ADAS SoC',                 'Bán dẫn',    'chip',   110, 80,  22, 6800000,  32),
('SKU-SEN-12', 'Cảm biến hình ảnh CMOS ô tô (Sony IMX)',  'Cảm biến',   'chiếc',  400, 300, 90, 1250000,  30);

-- ----------------------------------------------------------------------------
--  3. purchase_orders (9 orders)
--     current_risk_score / risk_breakdown are left NULL - ai/seed_ai_data.sql
--     computes them from these dates, reliability and stock.
-- ----------------------------------------------------------------------------
INSERT INTO purchase_orders (id, po_number, supplier_id, supplier_name, sku, sku_name,
                             quantity, unit_price, total_amount, order_date,
                             promised_delivery_date, actual_or_expected_delivery_date,
                             status, notes)
VALUES
('PO-ID-001', 'PO-2026-001', 'SUP-04', 'General Motors', 'SKU-BAT-05', 'Cell pin NCMA Ultium',
 100, 9120000, 912000000, '2026-09-01', '2026-10-01', '2026-10-01', 'Hoàn thành',
 'Giao đúng hạn, đã nhập kho.'),
('PO-ID-002', 'PO-2026-002', 'SUP-06', 'Tesla', 'SKU-BAT-04', 'Cell pin 4680 cylindrical (Tesla)',
 90, 8950000, 805500000, '2026-10-10', '2026-11-05', '2026-11-10', 'Đang giao',
 'Tàu cập Lạch Huyện, chờ kiểm định hàng nguy hiểm loại 9.'),
('PO-ID-003', 'PO-2026-003', 'SUP-01', 'Ford Motor', 'SKU-BAT-03', 'Cell pin LFP 48V (BlueOval SK)',
 80, 9300000, 744000000, '2026-10-05', '2026-11-04', '2026-11-15', 'Trễ hẹn',
 'Bị giữ tại Busan để kiểm tra hàng nguy hiểm loại 9 (pin lithium).'),
('PO-ID-004', 'PO-2026-004', 'SUP-07', 'NVIDIA', 'SKU-SOC-05', 'NVIDIA DRIVE Thor SoC',
 40, 28500000, 1140000000, '2026-10-20', '2026-11-24', '2026-11-24', 'Đang xử lý',
 'Chờ giấy phép xuất khẩu, dự kiến bay từ SFO.'),
('PO-ID-005', 'PO-2026-005', 'SUP-08', 'Advanced Micro Devices', 'SKU-FPG-08', 'AMD Xilinx Automotive FPGA',
 120, 4200000, 504000000, '2026-10-12', '2026-11-11', '2026-11-12', 'Đang giao',
 'Hàng không qua Anchorage - Incheon.'),
('PO-ID-006', 'PO-2026-006', 'SUP-09', 'Intel', 'SKU-ADS-06', 'Mobileye EyeQ6 ADAS SoC',
 100, 6800000, 680000000, '2026-10-08', '2026-11-09', '2026-11-12', 'Đang giao',
 'Chuyển tải tại Taoyuan, chậm 3 ngày do thiếu chỗ chuyến bay.'),
('PO-ID-008', 'PO-2026-008', 'SUP-10', 'Sony Group', 'SKU-SEN-12', 'Cảm biến hình ảnh CMOS ô tô (Sony IMX)',
 600, 1250000, 750000000, '2026-10-15', '2026-11-12', '2026-11-12', 'Đang giao',
 'Đúng lịch, đang trên biển Hoa Đông.'),
('PO-ID-009', 'PO-2026-009', 'SUP-05', 'TSMC', 'SKU-MCU-07', 'MCU ô tô 28nm (TSMC foundry)',
 1500, 1850000, 2775000000, '2026-10-01', '2026-11-05', '2026-11-29', 'Trễ hẹn',
 'Tàu feeder hoãn tại Kaohsiung do bất ổn eo biển Đài Loan.'),
('PO-ID-011', 'PO-2026-011', 'SUP-03', 'Rivian', 'SKU-MOT-09', 'Enduro drive unit & inverter',
 120, 10494000, 1259280000, '2026-10-14', '2026-11-10', '2026-11-24', 'Đang giao',
 'Container chờ cầu bến tại Long Beach, tàu dời lịch 14 ngày.');

-- ----------------------------------------------------------------------------
--  4. shipments (one per open order)
--     Risk score / level are placeholders; ai/seed_demo_finalize.sql copies
--     them from purchase_orders after ai/seed_ai_data.sql runs.
-- ----------------------------------------------------------------------------
INSERT INTO shipments (id, purchase_order_id, po_number, supplier_id, supplier_name, sku, sku_name,
                       quantity, unit, destination_warehouse, promised_delivery_date,
                       expected_delivery_date, delay_days, current_delay_risk_score, risk_level,
                       carrier_name, tracking_number)
SELECT 'SHP-' || po.po_number, po.id, po.po_number, po.supplier_id, po.supplier_name, po.sku, po.sku_name,
       po.quantity, inv.unit,
       CASE WHEN po.supplier_id = 'SUP-09'
            THEN '{"id":"WH-BD","name":"Kho ResiliChain Bình Dương","address":"VSIP 1, Thuận An, Bình Dương","latitude":10.9310,"longitude":106.7130}'::jsonb
            ELSE '{"id":"WH-HP","name":"Kho ResiliChain Hải Phòng","address":"KCN Đình Vũ, Hải An, Hải Phòng","latitude":20.8410,"longitude":106.7700}'::jsonb
       END,
       po.promised_delivery_date, po.actual_or_expected_delivery_date,
       (po.actual_or_expected_delivery_date::date - po.promised_delivery_date::date),
       0, 'LOW', c.carrier, c.tracking
FROM purchase_orders po
JOIN inventory_items inv ON inv.sku = po.sku
JOIN (VALUES
  ('PO-2026-002', 'Maersk Line',         'MAEU2611050021'),
  ('PO-2026-003', 'Hapag-Lloyd',         'HLCU2610050031'),
  ('PO-2026-004', 'FedEx Express',       'FDX7741200004'),
  ('PO-2026-005', 'UPS Air Freight',     '1Z8V40E20500057'),
  ('PO-2026-006', 'DHL Global Forwarding','DHL4410080006'),
  ('PO-2026-008', 'ONE (Ocean Network Express)', 'ONEY2610150008'),
  ('PO-2026-009', 'Evergreen Marine',    'EGLV2610010009'),
  ('PO-2026-011', 'CMA CGM',             'CMAU2610140011')
) AS c(po_number, carrier, tracking) ON c.po_number = po.po_number;

-- ----------------------------------------------------------------------------
--  5. shipment_tracking_points - GPS/AIS history up to 2026-11-07
-- ----------------------------------------------------------------------------
INSERT INTO shipment_tracking_points (id, shipment_id, purchase_order_id, po_number, supplier_id,
                                      supplier_name, latitude, longitude, location_name,
                                      recorded_at, source, speed_kmh, status_note)
SELECT 'TRK-' || t.po_number || '-' || lpad(t.seq::text, 2, '0'),
       'SHP-' || t.po_number, po.id, po.po_number, po.supplier_id, po.supplier_name,
       t.lat, t.lng, t.loc, t.at, t.src, t.speed, t.note
FROM (VALUES
  -- PO-2026-011 Rivian: stuck at Long Beach
  ('PO-2026-011', 1, 40.5140,  -89.0310, 'Rivian Normal Plant',        '2026-10-24T08:00:00Z', 'CarrierWebhook', 0,     'Đóng container, niêm phong.'),
  ('PO-2026-011', 2, 41.8500,  -87.6500, 'Chicago Intermodal Hub',     '2026-10-24T16:30:00Z', 'CarrierWebhook', 62.0,  'Lên tàu hỏa BNSF đi bờ Tây.'),
  ('PO-2026-011', 3, 35.0800, -106.6500, 'Albuquerque, New Mexico',    '2026-10-26T09:10:00Z', 'CarrierWebhook', 71.5,  'Đúng lịch đường sắt.'),
  ('PO-2026-011', 4, 33.7540, -118.2160, 'Port of Long Beach',         '2026-10-28T05:40:00Z', 'CarrierWebhook', 0,     'Đến cảng, chờ xếp tàu.'),
  ('PO-2026-011', 5, 33.7540, -118.2160, 'Port of Long Beach',         '2026-11-07T02:00:00Z', 'ManualUpdate',   0,     'Hãng tàu dời lịch chạy 14 ngày do ùn tắc cầu bến. ETA mới 24/11.'),
  -- PO-2026-009 TSMC: held at Kaohsiung
  ('PO-2026-009', 1, 24.7740,  121.0110, 'TSMC Fab 12, Hsinchu',       '2026-10-30T01:00:00Z', 'CarrierWebhook', 0,     'Xuất kho foundry.'),
  ('PO-2026-009', 2, 23.4800,  120.4500, 'Quốc lộ 1, Chiayi',          '2026-10-30T04:20:00Z', 'CarrierWebhook', 78.0,  'Xe tải trên đường tới cảng.'),
  ('PO-2026-009', 3, 22.6100,  120.2800, 'Port of Kaohsiung',          '2026-10-30T07:45:00Z', 'CarrierWebhook', 0,     'Đến cảng Kaohsiung.'),
  ('PO-2026-009', 4, 22.6100,  120.2800, 'Port of Kaohsiung',          '2026-11-06T22:00:00Z', 'ManualUpdate',   0,     'Tàu feeder hoãn khởi hành do bất ổn eo biển Đài Loan. ETA mới 29/11.'),
  -- PO-2026-003 Ford: held at Busan
  ('PO-2026-003', 1, 37.6020,  -85.9060, 'BlueOval SK Kentucky',       '2026-10-08T10:00:00Z', 'CarrierWebhook', 0,     'Xuất xưởng cell pin LFP.'),
  ('PO-2026-003', 2, 35.1495,  -90.0490, 'Memphis Rail Hub',           '2026-10-09T02:00:00Z', 'CarrierWebhook', 58.0,  'Trung chuyển đường sắt.'),
  ('PO-2026-003', 3, 33.7540, -118.2160, 'Port of Long Beach',         '2026-10-12T06:00:00Z', 'CarrierWebhook', 0,     'Xếp tàu Hapag-Lloyd.'),
  ('PO-2026-003', 4, 38.5000, -165.0000, 'Bắc Thái Bình Dương',        '2026-10-20T12:00:00Z', 'CarrierWebhook', 33.5,  'Đang hải trình.'),
  ('PO-2026-003', 5, 35.1040,  129.0400, 'Port of Busan',              '2026-10-30T03:00:00Z', 'CarrierWebhook', 0,     'Cập cảng chuyển tải.'),
  ('PO-2026-003', 6, 35.1040,  129.0400, 'Port of Busan',              '2026-11-06T09:00:00Z', 'ManualUpdate',   0,     'Hải quan giữ hàng nguy hiểm loại 9 (pin lithium) để kiểm tra. ETA mới 15/11.'),
  -- PO-2026-002 Tesla: arrived Hai Phong, DG inspection
  ('PO-2026-002', 1, 39.5380, -119.4430, 'Gigafactory Nevada',         '2026-10-13T09:00:00Z', 'CarrierWebhook', 0,     'Xuất xưởng cell 4680.'),
  ('PO-2026-002', 2, 37.7950, -122.3200, 'Port of Oakland',            '2026-10-14T03:00:00Z', 'CarrierWebhook', 0,     'Xếp tàu Maersk.'),
  ('PO-2026-002', 3, 35.1040,  129.0400, 'Port of Busan',              '2026-10-28T11:00:00Z', 'CarrierWebhook', 0,     'Chuyển tải.'),
  ('PO-2026-002', 4, 20.8330,  106.8900, 'Cảng Lạch Huyện, Hải Phòng', '2026-11-06T15:00:00Z', 'CarrierWebhook', 0,     'Cập cảng, chờ kiểm định hàng nguy hiểm. ETA kho 10/11.'),
  -- PO-2026-004 NVIDIA: not yet shipped
  ('PO-2026-004', 1, 37.3700, -121.9640, 'NVIDIA Santa Clara',         '2026-11-05T17:00:00Z', 'ManualUpdate',   0,     'Đã đóng gói, chờ giấy phép xuất khẩu EAR.'),
  -- PO-2026-005 AMD: air freight via Anchorage
  ('PO-2026-005', 1, 37.2930, -121.9280, 'AMD Xilinx San Jose',        '2026-11-06T18:00:00Z', 'CarrierWebhook', 0,     'Bàn giao UPS.'),
  ('PO-2026-005', 2, 61.1740, -149.9960, 'Ted Stevens Anchorage Intl', '2026-11-07T04:30:00Z', 'CarrierWebhook', 0,     'Chuyển tải hàng không.'),
  -- PO-2026-006 Intel: transit Taoyuan
  ('PO-2026-006', 1, 33.2700, -111.8900, 'Intel Ocotillo Chandler',    '2026-11-04T15:00:00Z', 'CarrierWebhook', 0,     'Bàn giao DHL.'),
  ('PO-2026-006', 2, 33.9420, -118.4080, 'Los Angeles Intl Airport',   '2026-11-05T02:00:00Z', 'CarrierWebhook', 0,     'Cất cánh chuyến hàng.'),
  ('PO-2026-006', 3, 25.0800,  121.2330, 'Taoyuan Intl Airport',       '2026-11-06T09:00:00Z', 'CarrierWebhook', 0,     'Chờ chuyến nối, thiếu chỗ tải. Trễ dự kiến 3 ngày.'),
  -- PO-2026-008 Sony: at sea, on time
  ('PO-2026-008', 1, 32.8700,  130.7600, 'Sony Semiconductor Kumamoto','2026-11-04T01:00:00Z', 'CarrierWebhook', 0,     'Xuất xưởng.'),
  ('PO-2026-008', 2, 33.6100,  130.4000, 'Hakata Port, Fukuoka',       '2026-11-04T08:00:00Z', 'CarrierWebhook', 0,     'Xếp tàu ONE.'),
  ('PO-2026-008', 3, 30.5000,  125.5000, 'Biển Hoa Đông',              '2026-11-07T00:00:00Z', 'CarrierWebhook', 35.2,  'Đúng lịch.')
) AS t(po_number, seq, lat, lng, loc, at, src, speed, note)
JOIN purchase_orders po ON po.po_number = t.po_number;

COMMIT;
