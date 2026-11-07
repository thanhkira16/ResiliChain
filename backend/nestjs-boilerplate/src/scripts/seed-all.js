const { Client } = require('pg');

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nest_boilerplate',
  });

  await client.connect();
  console.log('Connected to PostgreSQL database');

  try {
    await client.query('BEGIN');

    // 1. SUPPLIERS
    console.log('Seeding suppliers...');
    const suppliers = [
      {
        id: 'SUP-01',
        name: 'Ford Motor',
        contact_person: 'Jim Farley (CEO) / John Lawler',
        email: 'supplychain@ford.com',
        phone: '+1-800-392-3673',
        provided_skus: JSON.stringify(['SKU-BAT-03', 'SKU-FRM-01', 'SKU-WHL-02', 'SKU-HBR-06']),
        average_lead_time_days: 27,
        historical_price: JSON.stringify({
          'SKU-BAT-03': [{ date: '2026-09-01', unitPrice: 9300000 }],
          'SKU-FRM-01': [{ date: '2026-09-01', unitPrice: 2400000 }],
          'SKU-WHL-02': [{ date: '2026-09-01', unitPrice: 1580000 }],
        }),
        reliability_score: 82,
        address: 'One American Road, Dearborn, Michigan, USA',
        transit_waypoints: JSON.stringify([
          { orderIndex: 1, locationName: 'Nhà máy BlueOval Battery Park (Michigan, USA)', checkpointType: 'OriginWarehouse', description: 'Đóng gói cell pin trong container bảo ôn' },
          { orderIndex: 2, locationName: 'Cảng Long Beach (California)', checkpointType: 'TransitHub', description: 'Bốc dỡ lên tàu vận tải viễn dương' },
          { orderIndex: 3, locationName: 'Hải phận Thái Bình Dương (Gần Guam)', checkpointType: 'TollPlaza', description: 'Tàu hàng di chuyển hải trình Châu Á' },
          { orderIndex: 4, locationName: 'Cảng Hải Phòng (Đình Vũ)', checkpointType: 'TransitHub', description: 'Thông quan hàng điện tử công nghệ cao' },
          { orderIndex: 5, locationName: 'Tổ hợp Lắp ráp Xe điện Bắc Ninh (Kho đích)', checkpointType: 'DestinationWarehouse', description: 'Nhập kho dây chuyền Pack Pin EV' },
        ]),
      },
      {
        id: 'SUP-02',
        name: 'Lucid Motors',
        contact_person: 'Peter Rawlinson (CTO/CEO)',
        email: 'procurement@lucidmotors.com',
        phone: '+1-888-995-8243',
        provided_skus: JSON.stringify(['SKU-MOT-09', 'SKU-CHN-04', 'SKU-CAS-07']),
        average_lead_time_days: 28,
        historical_price: JSON.stringify({
          'SKU-MOT-09': [{ date: '2026-09-01', unitPrice: 10303200 }],
          'SKU-CHN-04': [{ date: '2026-09-01', unitPrice: 315000 }],
          'SKU-CAS-07': [{ date: '2026-09-01', unitPrice: 735000 }],
        }),
        reliability_score: 63,
        address: '7373 Gateway Blvd, Newark, CA 94560, USA',
        transit_waypoints: JSON.stringify([
          { orderIndex: 1, locationName: 'Lucid AMP-1 Factory (Casa Grande, Arizona)', checkpointType: 'OriginWarehouse' },
          { orderIndex: 2, locationName: 'Cảng Los Angeles', checkpointType: 'TransitHub' },
          { orderIndex: 3, locationName: 'Cảng Cát Lái (TP.HCM)', checkpointType: 'TransitHub' },
          { orderIndex: 4, locationName: 'Kho Tổng Logistics Dĩ An, Bình Dương', checkpointType: 'DestinationWarehouse' },
        ]),
      },
      {
        id: 'SUP-03',
        name: 'Rivian',
        contact_person: 'RJ Scaringe / Claire McDonough',
        email: 'orders@rivian.com',
        phone: '+1-888-748-4261',
        provided_skus: JSON.stringify(['SKU-MOT-09', 'SKU-BRK-03']),
        average_lead_time_days: 27,
        historical_price: JSON.stringify({
          'SKU-MOT-09': [{ date: '2026-09-01', unitPrice: 10494000 }],
          'SKU-BRK-03': [{ date: '2026-09-01', unitPrice: 930000 }],
        }),
        reliability_score: 68,
        address: '14600 Myford Road, Irvine, CA 92606, USA',
        transit_waypoints: JSON.stringify([
          { orderIndex: 1, locationName: 'Nhà máy Rivian Normal (Illinois, USA)', checkpointType: 'OriginWarehouse' },
          { orderIndex: 2, locationName: 'Cảng Oakland (San Francisco)', checkpointType: 'TransitHub' },
          { orderIndex: 3, locationName: 'Cảng Đà Nẵng (Tiên Sa)', checkpointType: 'TransitHub' },
          { orderIndex: 4, locationName: 'Tổng kho Trung chuyển Đà Nẵng', checkpointType: 'DestinationWarehouse' },
        ]),
      },
      {
        id: 'SUP-04',
        name: 'General Motors',
        contact_person: 'Mary Barra (CEO) / Mark Reuss',
        email: 'global.purchasing@gm.com',
        phone: '+1-800-222-1020',
        provided_skus: JSON.stringify(['SKU-BAT-03', 'SKU-SDL-05', 'SKU-LGT-08']),
        average_lead_time_days: 30,
        historical_price: JSON.stringify({
          'SKU-BAT-03': [{ date: '2026-09-01', unitPrice: 9439500 }],
          'SKU-SDL-05': [{ date: '2026-09-01', unitPrice: 670000 }],
          'SKU-LGT-08': [{ date: '2026-09-01', unitPrice: 215000 }],
        }),
        reliability_score: 76,
        address: '300 Renaissance Center, Detroit, Michigan, USA',
        transit_waypoints: JSON.stringify([
          { orderIndex: 1, locationName: 'Ultium Cells LLC Factory (Warren, Ohio)', checkpointType: 'OriginWarehouse' },
          { orderIndex: 2, locationName: 'Cảng Hải Phòng (Đình Vũ)', checkpointType: 'TransitHub' },
          { orderIndex: 3, locationName: 'Nhà máy Lắp ráp Bắc Ninh', checkpointType: 'DestinationWarehouse' },
        ]),
      },
      {
        id: 'SUP-05',
        name: 'TSMC',
        contact_person: 'C.C. Wei (Chairman & CEO)',
        email: 'automotive@tsmc.com',
        phone: '+886-3-5636688',
        provided_skus: JSON.stringify(['SKU-SEMI-05', 'SKU-FRM-01', 'SKU-WHL-02']),
        average_lead_time_days: 18,
        historical_price: JSON.stringify({
          'SKU-SEMI-05': [{ date: '2026-09-01', unitPrice: 1850000 }],
          'SKU-FRM-01': [{ date: '2026-09-01', unitPrice: 2450000 }],
        }),
        reliability_score: 96,
        address: 'No. 8, Li-Hsin Rd. 6, Hsinchu Science Park, Taiwan',
        transit_waypoints: JSON.stringify([
          { orderIndex: 1, locationName: 'Fab 18 GigaFab (Tainan, Taiwan)', checkpointType: 'OriginWarehouse' },
          { orderIndex: 2, locationName: 'Sân bay Quốc tế Đào Viên (TPE)', checkpointType: 'TransitHub' },
          { orderIndex: 3, locationName: 'Sân bay Quốc tế Nội Bài (HAN)', checkpointType: 'TransitHub' },
          { orderIndex: 4, locationName: 'Nhà máy Lắp ráp Bắc Ninh (Kho đích)', checkpointType: 'DestinationWarehouse' },
        ]),
      },
      {
        id: 'SUP-06',
        name: 'Tesla',
        contact_person: 'Elon Musk / Tom Zhu',
        email: 'energy-supply@tesla.com',
        phone: '+1-888-518-3752',
        provided_skus: JSON.stringify(['SKU-BAT-03']),
        average_lead_time_days: 26,
        historical_price: JSON.stringify({
          'SKU-BAT-03': [{ date: '2026-09-01', unitPrice: 9746400 }],
        }),
        reliability_score: 82,
        address: '1 Tesla Road, Austin, Texas 78725, USA',
        transit_waypoints: JSON.stringify([
          { orderIndex: 1, locationName: 'Giga Texas Battery Cell Plant', checkpointType: 'OriginWarehouse' },
          { orderIndex: 2, locationName: 'Cảng Houston', checkpointType: 'TransitHub' },
          { orderIndex: 3, locationName: 'Nhà máy Lắp ráp Bắc Ninh', checkpointType: 'DestinationWarehouse' },
        ]),
      },
      {
        id: 'SUP-07',
        name: 'Nvidia',
        contact_person: 'Jensen Huang (Founder & CEO)',
        email: 'drive-enterprise@nvidia.com',
        phone: '+1-408-486-2000',
        provided_skus: JSON.stringify(['SKU-SEMI-07']),
        average_lead_time_days: 14,
        historical_price: JSON.stringify({
          'SKU-SEMI-07': [{ date: '2026-09-01', unitPrice: 42000000 }],
        }),
        reliability_score: 94,
        address: '2788 San Tomas Expressway, Santa Clara, CA 95051, USA',
        transit_waypoints: JSON.stringify([
          { orderIndex: 1, locationName: 'Santa Clara Silicon Hub', checkpointType: 'OriginWarehouse' },
          { orderIndex: 2, locationName: 'Nhà máy Lắp ráp Bắc Ninh', checkpointType: 'DestinationWarehouse' },
        ]),
      },
      {
        id: 'SUP-08',
        name: 'Advanced Micro Devices',
        contact_person: 'Lisa Su (Chair & CEO)',
        email: 'embedded@amd.com',
        phone: '+1-408-749-4000',
        provided_skus: JSON.stringify(['SKU-SEMI-08']),
        average_lead_time_days: 21,
        historical_price: JSON.stringify({
          'SKU-SEMI-08': [{ date: '2026-09-01', unitPrice: 15500000 }],
        }),
        reliability_score: 91,
        address: '2485 Augustine Drive, Santa Clara, CA 95054, USA',
        transit_waypoints: JSON.stringify([
          { orderIndex: 1, locationName: 'AMD Austin Campus', checkpointType: 'OriginWarehouse' },
          { orderIndex: 2, locationName: 'Nhà máy Lắp ráp Bắc Ninh', checkpointType: 'DestinationWarehouse' },
        ]),
      },
      {
        id: 'SUP-09',
        name: 'Intel',
        contact_person: 'Pat Gelsinger / Amnon Shashua (Mobileye)',
        email: 'automotive-solutions@intel.com',
        phone: '+1-408-765-8080',
        provided_skus: JSON.stringify(['SKU-SEMI-09']),
        average_lead_time_days: 25,
        historical_price: JSON.stringify({
          'SKU-SEMI-09': [{ date: '2026-09-01', unitPrice: 8900000 }],
        }),
        reliability_score: 87,
        address: '2200 Mission College Blvd, Santa Clara, CA 95054, USA',
        transit_waypoints: JSON.stringify([
          { orderIndex: 1, locationName: 'Intel Ocotillo Fab (Chandler, Arizona)', checkpointType: 'OriginWarehouse' },
          { orderIndex: 2, locationName: 'Kho Tổng Logistics Dĩ An', checkpointType: 'DestinationWarehouse' },
        ]),
      },
      {
        id: 'SUP-10',
        name: 'Sony Group',
        contact_person: 'Kenichiro Yoshida / Terushi Shimizu',
        email: 'semiconductor@sony.com',
        phone: '+81-3-6748-2111',
        provided_skus: JSON.stringify(['SKU-SEN-12']),
        average_lead_time_days: 16,
        historical_price: JSON.stringify({
          'SKU-SEN-12': [{ date: '2026-09-01', unitPrice: 3450000 }],
        }),
        reliability_score: 95,
        address: '1-7-1 Konan, Minato-ku, Tokyo, Japan',
        transit_waypoints: JSON.stringify([
          { orderIndex: 1, locationName: 'Sony Semiconductor Kumamoto Tech Center', checkpointType: 'OriginWarehouse' },
          { orderIndex: 2, locationName: 'Nhà máy Lắp ráp Bắc Ninh', checkpointType: 'DestinationWarehouse' },
        ]),
      },
    ];

    for (const s of suppliers) {
      await client.query(`
        INSERT INTO suppliers (id, name, contact_person, email, phone, provided_skus, average_lead_time_days, historical_price, reliability_score, address, transit_waypoints)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          contact_person = EXCLUDED.contact_person,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          provided_skus = EXCLUDED.provided_skus,
          average_lead_time_days = EXCLUDED.average_lead_time_days,
          historical_price = EXCLUDED.historical_price,
          reliability_score = EXCLUDED.reliability_score,
          address = EXCLUDED.address,
          transit_waypoints = EXCLUDED.transit_waypoints;
      `, [s.id, s.name, s.contact_person, s.email, s.phone, s.provided_skus, s.average_lead_time_days, s.historical_price, s.reliability_score, s.address, s.transit_waypoints]);
    }

    // 2. INVENTORY ITEMS
    console.log('Seeding inventory items...');
    const inventory = [
      { sku: 'SKU-BAT-03', name: 'Cell pin LFP 48V (BlueOval SK)', category: 'Pin & Lưu Trữ Năng Lượng', unit: 'pack', current_stock: 42, safety_stock: 80, weekly_burn_rate: 18, unit_price_estimate: 9300000, min_lead_time_days: 20 },
      { sku: 'SKU-MOT-09', name: 'Enduro drive unit & inverter', category: 'Cụm Động Cơ Điện & Biến Tần', unit: 'cụm', current_stock: 31, safety_stock: 60, weekly_burn_rate: 10, unit_price_estimate: 10494000, min_lead_time_days: 20 },
      { sku: 'SKU-SEMI-05', name: 'MCU ô tô ARM Cortex-R52', category: 'Chip Bán Dẫn & Vi Điều Khiển', unit: 'con', current_stock: 1200, safety_stock: 2000, weekly_burn_rate: 350, unit_price_estimate: 1850000, min_lead_time_days: 14 },
      { sku: 'SKU-SEMI-07', name: 'SoC Nvidia DRIVE Thor 2000 TOPS', category: 'Bộ Xử Lý Lái Tự Động ADAS', unit: 'chip', current_stock: 45, safety_stock: 80, weekly_burn_rate: 12, unit_price_estimate: 42000000, min_lead_time_days: 14 },
      { sku: 'SKU-SEMI-08', name: 'Xilinx automotive FPGA', category: 'Chip Khả Lập Trình Xử Lý Cảm Biến', unit: 'chip', current_stock: 90, safety_stock: 150, weekly_burn_rate: 25, unit_price_estimate: 15500000, min_lead_time_days: 15 },
      { sku: 'SKU-SEMI-09', name: 'Mobileye EyeQ6 High SoC', category: 'Vision Processor Ô Tô', unit: 'chip', current_stock: 110, safety_stock: 180, weekly_burn_rate: 30, unit_price_estimate: 8900000, min_lead_time_days: 18 },
      { sku: 'SKU-SEN-12', name: 'Cảm biến CMOS Automotive 8MP', category: 'Cảm Biến Hình Ảnh & LiDAR', unit: 'module', current_stock: 350, safety_stock: 500, weekly_burn_rate: 75, unit_price_estimate: 3450000, min_lead_time_days: 12 },
      { sku: 'SKU-FRM-01', name: 'Khung gầm hợp kim nhôm Aluxx EV', category: 'Khung Gầm & Thân Vỏ', unit: 'bộ', current_stock: 85, safety_stock: 120, weekly_burn_rate: 22, unit_price_estimate: 2400000, min_lead_time_days: 7 },
      { sku: 'SKU-WHL-02', name: 'Bộ vành đúc khí động học Aero EV', category: 'Bánh Xe & Khí Động Học', unit: 'cặp', current_stock: 110, safety_stock: 150, weekly_burn_rate: 28, unit_price_estimate: 1580000, min_lead_time_days: 6 },
      { sku: 'SKU-BRK-03', name: 'Bộ phanh đĩa tái sinh năng lượng EV', category: 'Hệ Thống Phanh & An Toàn', unit: 'bộ', current_stock: 38, safety_stock: 80, weekly_burn_rate: 15, unit_price_estimate: 930000, min_lead_time_days: 12 },
      { sku: 'SKU-CHN-04', name: 'Đai truyền động carbon lực căng cao', category: 'Truyền Lực', unit: 'sợi', current_stock: 160, safety_stock: 200, weekly_burn_rate: 35, unit_price_estimate: 315000, min_lead_time_days: 5 },
      { sku: 'SKU-SDL-05', name: 'Ghế bọc da sinh thái công thái học', category: 'Nội Thất & Tiện Nghi', unit: 'chiếc', current_stock: 65, safety_stock: 90, weekly_burn_rate: 14, unit_price_estimate: 670000, min_lead_time_days: 6 },
      { sku: 'SKU-HBR-06', name: 'Cụm vô lăng trợ lực điện Steer-by-Wire', category: 'Hệ Thống Lái', unit: 'cụm', current_stock: 45, safety_stock: 70, weekly_burn_rate: 11, unit_price_estimate: 440000, min_lead_time_days: 7 },
      { sku: 'SKU-CAS-07', name: 'Bộ giảm tốc hành tinh 1 cấp EV', category: 'Hộp Số & Vi Sai', unit: 'bộ', current_stock: 75, safety_stock: 100, weekly_burn_rate: 16, unit_price_estimate: 735000, min_lead_time_days: 5 },
      { sku: 'SKU-LGT-08', name: 'Cụm đèn pha Matrix LED thích ứng', category: 'Hệ Thống Chiếu Sáng', unit: 'bộ', current_stock: 120, safety_stock: 140, weekly_burn_rate: 20, unit_price_estimate: 215000, min_lead_time_days: 6 },
    ];

    for (const inv of inventory) {
      await client.query(`
        INSERT INTO inventory_items (sku, name, category, unit, current_stock, safety_stock, weekly_burn_rate, unit_price_estimate, min_lead_time_days)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (sku) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          unit = EXCLUDED.unit,
          current_stock = EXCLUDED.current_stock,
          safety_stock = EXCLUDED.safety_stock,
          weekly_burn_rate = EXCLUDED.weekly_burn_rate,
          unit_price_estimate = EXCLUDED.unit_price_estimate,
          min_lead_time_days = EXCLUDED.min_lead_time_days;
      `, [inv.sku, inv.name, inv.category, inv.unit, inv.current_stock, inv.safety_stock, inv.weekly_burn_rate, inv.unit_price_estimate, inv.min_lead_time_days]);
    }

    // 3. PURCHASE ORDERS
    console.log('Seeding purchase orders...');
    const orders = [
      { id: 'po-1', po_number: 'PO-2026-001', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', sku: 'SKU-FRM-01', sku_name: 'Khung gầm hợp kim nhôm Aluxx EV', quantity: 100, unit_price: 2400000, total_amount: 240000000, order_date: '2026-08-15', promised_delivery_date: '2026-08-28', actual_or_expected_delivery_date: '2026-08-27', status: 'Hoàn thành', current_risk_score: 12, notes: 'Giao đúng hạn, chất lượng kiểm định đạt 100%' },
      { id: 'po-2', po_number: 'PO-2026-002', supplier_id: 'SUP-02', supplier_name: 'Lucid Motors', sku: 'SKU-CHN-04', sku_name: 'Đai truyền động carbon lực căng cao', quantity: 200, unit_price: 315000, total_amount: 63000000, order_date: '2026-08-20', promised_delivery_date: '2026-08-30', actual_or_expected_delivery_date: '2026-08-30', status: 'Hoàn thành', current_risk_score: 8, notes: 'Đã hoàn tất nghiệm thu kỹ thuật' },
      { id: 'po-3', po_number: 'PO-2026-003', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', sku: 'SKU-BAT-03', sku_name: 'Cell pin LFP 48V (BlueOval SK)', quantity: 80, unit_price: 9300000, total_amount: 744000000, order_date: '2026-08-10', promised_delivery_date: '2026-09-06', actual_or_expected_delivery_date: '2026-09-21', status: 'Đang giao', current_risk_score: 38, notes: 'Tàu hàng bị lưu tại cảng trung chuyển Long Beach' },
      { id: 'po-4', po_number: 'PO-2026-004', supplier_id: 'SUP-04', supplier_name: 'General Motors', sku: 'SKU-SDL-05', sku_name: 'Ghế bọc da sinh thái công thái học', quantity: 50, unit_price: 670000, total_amount: 33500000, order_date: '2026-08-28', promised_delivery_date: '2026-09-03', actual_or_expected_delivery_date: '2026-09-09', status: 'Trễ hẹn', current_risk_score: 42, notes: 'Mưa lớn gây ngập đường cao tốc liên tỉnh' },
      { id: 'po-5', po_number: 'PO-2026-005', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', sku: 'SKU-HBR-06', sku_name: 'Cụm vô lăng trợ lực điện Steer-by-Wire', quantity: 70, unit_price: 440000, total_amount: 30800000, order_date: '2026-09-01', promised_delivery_date: '2026-09-08', actual_or_expected_delivery_date: '2026-09-08', status: 'Đang giao', current_risk_score: 28, notes: 'Đang qua trạm thu phí Hải Dương' },
      { id: 'po-6', po_number: 'PO-2026-006', supplier_id: 'SUP-05', supplier_name: 'TSMC', sku: 'SKU-SEMI-05', sku_name: 'MCU ô tô ARM Cortex-R52', quantity: 300, unit_price: 1850000, total_amount: 555000000, order_date: '2026-08-25', promised_delivery_date: '2026-09-12', actual_or_expected_delivery_date: '2026-09-15', status: 'Đang giao', current_risk_score: 52, notes: 'Bão biển ảnh hưởng lịch bay vận tải hàng không' },
      { id: 'po-7', po_number: 'PO-2026-007', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', sku: 'SKU-FRM-01', sku_name: 'Khung gầm hợp kim nhôm Aluxx EV', quantity: 60, unit_price: 2400000, total_amount: 144000000, order_date: '2026-08-30', promised_delivery_date: '2026-09-11', actual_or_expected_delivery_date: '2026-09-14', status: 'Đang giao', current_risk_score: 35, notes: 'Trễ 3 ngày do tắc nghẽn thông quan' },
      { id: 'po-8', po_number: 'PO-2026-008', supplier_id: 'SUP-02', supplier_name: 'Lucid Motors', sku: 'SKU-CAS-07', sku_name: 'Bộ giảm tốc hành tinh 1 cấp EV', quantity: 50, unit_price: 735000, total_amount: 36750000, order_date: '2026-09-05', promised_delivery_date: '2026-09-10', actual_or_expected_delivery_date: '2026-09-10', status: 'Đang xử lý', current_risk_score: 15, notes: 'Đang đóng gói xuất xưởng tại KCN Sóng Thần' },
      { id: 'po-9', po_number: 'PO-2026-009', supplier_id: 'SUP-04', supplier_name: 'General Motors', sku: 'SKU-BAT-03', sku_name: 'Cell pin LFP 48V (BlueOval SK)', quantity: 100, unit_price: 9439500, total_amount: 943950000, order_date: '2026-08-15', promised_delivery_date: '2026-09-05', actual_or_expected_delivery_date: '2026-09-17', status: 'Đang giao', current_risk_score: 46, notes: 'Đình công tại cảng Đình Vũ làm chậm dỡ hàng' },
      { id: 'po-10', po_number: 'PO-2026-010', supplier_id: 'SUP-05', supplier_name: 'TSMC', sku: 'SKU-SEMI-05', sku_name: 'MCU ô tô ARM Cortex-R52', quantity: 500, unit_price: 1850000, total_amount: 925000000, order_date: '2026-08-01', promised_delivery_date: '2026-08-19', actual_or_expected_delivery_date: '2026-08-18', status: 'Hoàn thành', current_risk_score: 10, notes: 'Giao hàng thành công trước hạn 1 ngày' },
      { id: 'po-11', po_number: 'PO-2026-011', supplier_id: 'SUP-03', supplier_name: 'Rivian', sku: 'SKU-MOT-09', sku_name: 'Enduro drive unit & inverter', quantity: 120, unit_price: 10494000, total_amount: 1259280000, order_date: '2026-08-15', promised_delivery_date: '2026-09-11', actual_or_expected_delivery_date: '2026-09-26', status: 'Đang giao', current_risk_score: 48, notes: 'Giám đốc tài chính từ chức, chậm trễ logistics tại xưởng Normal' },
      { id: 'po-12', po_number: 'PO-2026-012', supplier_id: 'SUP-02', supplier_name: 'Lucid Motors', sku: 'SKU-CHN-04', sku_name: 'Đai truyền động carbon lực căng cao', quantity: 120, unit_price: 315000, total_amount: 37800000, order_date: '2026-09-02', promised_delivery_date: '2026-09-09', actual_or_expected_delivery_date: '2026-09-09', status: 'Đang giao', current_risk_score: 14, notes: 'Tiến độ vận chuyển bình thường' },
      { id: 'po-13', po_number: 'PO-2026-013', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', sku: 'SKU-WHL-02', sku_name: 'Bộ vành đúc khí động học Aero EV', quantity: 90, unit_price: 1580000, total_amount: 142200000, order_date: '2026-08-10', promised_delivery_date: '2026-08-25', actual_or_expected_delivery_date: '2026-08-24', status: 'Hoàn thành', current_risk_score: 11, notes: 'Đã nhập kho Bắc Ninh đúng chuẩn' },
      { id: 'po-14', po_number: 'PO-2026-014', supplier_id: 'SUP-04', supplier_name: 'General Motors', sku: 'SKU-LGT-08', sku_name: 'Cụm đèn pha Matrix LED thích ứng', quantity: 100, unit_price: 215000, total_amount: 21500000, order_date: '2026-08-15', promised_delivery_date: '2026-08-25', actual_or_expected_delivery_date: '2026-08-25', status: 'Hoàn thành', current_risk_score: 9, notes: 'Chất lượng xuất sắc' },
      { id: 'po-15', po_number: 'PO-2026-015', supplier_id: 'SUP-05', supplier_name: 'TSMC', sku: 'SKU-FRM-01', sku_name: 'Khung gầm hợp kim nhôm Aluxx EV', quantity: 45, unit_price: 2450000, total_amount: 110250000, order_date: '2026-09-06', promised_delivery_date: '2026-09-15', actual_or_expected_delivery_date: '2026-09-15', status: 'Đang xử lý', current_risk_score: 16, notes: 'Đang kiểm tra chất lượng phôi hợp kim' },
    ];

    for (const o of orders) {
      await client.query(`
        INSERT INTO purchase_orders (id, po_number, supplier_id, supplier_name, sku, sku_name, quantity, unit_price, total_amount, order_date, promised_delivery_date, actual_or_expected_delivery_date, status, current_risk_score, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          po_number = EXCLUDED.po_number,
          supplier_id = EXCLUDED.supplier_id,
          supplier_name = EXCLUDED.supplier_name,
          sku = EXCLUDED.sku,
          sku_name = EXCLUDED.sku_name,
          quantity = EXCLUDED.quantity,
          unit_price = EXCLUDED.unit_price,
          total_amount = EXCLUDED.total_amount,
          order_date = EXCLUDED.order_date,
          promised_delivery_date = EXCLUDED.promised_delivery_date,
          actual_or_expected_delivery_date = EXCLUDED.actual_or_expected_delivery_date,
          status = EXCLUDED.status,
          current_risk_score = EXCLUDED.current_risk_score,
          notes = EXCLUDED.notes;
      `, [o.id, o.po_number, o.supplier_id, o.supplier_name, o.sku, o.sku_name, o.quantity, o.unit_price, o.total_amount, o.order_date, o.promised_delivery_date, o.actual_or_expected_delivery_date, o.status, o.current_risk_score, o.notes]);
    }

    // 4. SHIPMENTS
    console.log('Seeding shipments...');
    const defaultWarehouse = {
      id: 'WH-BN-01',
      name: 'Nhà máy Lắp ráp Bắc Ninh (Kho Đích)',
      latitude: 21.18,
      longitude: 106.07,
      capacityUnits: 15000,
      currentStockUnits: 8200,
    };

    const shipments = [
      {
        id: 'SHIP-PO-003',
        purchase_order_id: 'po-3',
        po_number: 'PO-2026-003',
        supplier_id: 'SUP-01',
        supplier_name: 'Ford Motor',
        sku: 'SKU-BAT-03',
        sku_name: 'Cell pin LFP 48V (BlueOval SK)',
        quantity: 80,
        unit: 'pack',
        destination_warehouse: JSON.stringify(defaultWarehouse),
        promised_delivery_date: '2026-09-06',
        expected_delivery_date: '2026-09-21',
        delay_days: 15,
        current_delay_risk_score: 38,
        risk_level: 'HIGH',
        carrier_name: 'Maersk Line Intermodal',
        tracking_number: 'MSK-99214-VN',
      },
      {
        id: 'SHIP-PO-001',
        purchase_order_id: 'po-1',
        po_number: 'PO-2026-001',
        supplier_id: 'SUP-01',
        supplier_name: 'Ford Motor',
        sku: 'SKU-FRM-01',
        sku_name: 'Khung gầm hợp kim nhôm Aluxx EV',
        quantity: 100,
        unit: 'bộ',
        destination_warehouse: JSON.stringify(defaultWarehouse),
        promised_delivery_date: '2026-08-28',
        expected_delivery_date: '2026-08-27',
        delay_days: 0,
        current_delay_risk_score: 12,
        risk_level: 'LOW',
        carrier_name: 'Vận tải Bắc Nam Express',
        tracking_number: 'BNX-88214-VN',
      },
      {
        id: 'SHIP-PO-004',
        purchase_order_id: 'po-4',
        po_number: 'PO-2026-004',
        supplier_id: 'SUP-04',
        supplier_name: 'General Motors',
        sku: 'SKU-SDL-05',
        sku_name: 'Ghế bọc da sinh thái công thái học',
        quantity: 50,
        unit: 'chiếc',
        destination_warehouse: JSON.stringify(defaultWarehouse),
        promised_delivery_date: '2026-09-03',
        expected_delivery_date: '2026-09-09',
        delay_days: 6,
        current_delay_risk_score: 42,
        risk_level: 'MEDIUM',
        carrier_name: 'Apex Global Logistics',
        tracking_number: 'APX-77124-VN',
      },
      {
        id: 'SHIP-PO-005',
        purchase_order_id: 'po-5',
        po_number: 'PO-2026-005',
        supplier_id: 'SUP-01',
        supplier_name: 'Ford Motor',
        sku: 'SKU-HBR-06',
        sku_name: 'Cụm vô lăng trợ lực điện Steer-by-Wire',
        quantity: 70,
        unit: 'cụm',
        destination_warehouse: JSON.stringify(defaultWarehouse),
        promised_delivery_date: '2026-09-08',
        expected_delivery_date: '2026-09-08',
        delay_days: 0,
        current_delay_risk_score: 28,
        risk_level: 'LOW',
        carrier_name: 'ALS Cargo Nội Bài',
        tracking_number: 'ALS-55421-HAN',
      },
      {
        id: 'SHIP-PO-006',
        purchase_order_id: 'po-6',
        po_number: 'PO-2026-006',
        supplier_id: 'SUP-05',
        supplier_name: 'TSMC',
        sku: 'SKU-SEMI-05',
        sku_name: 'MCU ô tô ARM Cortex-R52',
        quantity: 300,
        unit: 'con',
        destination_warehouse: JSON.stringify(defaultWarehouse),
        promised_delivery_date: '2026-09-12',
        expected_delivery_date: '2026-09-15',
        delay_days: 3,
        current_delay_risk_score: 52,
        risk_level: 'MEDIUM',
        carrier_name: 'China Airlines Cargo / Viettel Post',
        tracking_number: 'CAL-66321-TPE',
      },
      {
        id: 'SHIP-PO-007',
        purchase_order_id: 'po-7',
        po_number: 'PO-2026-007',
        supplier_id: 'SUP-01',
        supplier_name: 'Ford Motor',
        sku: 'SKU-FRM-01',
        sku_name: 'Khung gầm hợp kim nhôm Aluxx EV',
        quantity: 60,
        unit: 'bộ',
        destination_warehouse: JSON.stringify(defaultWarehouse),
        promised_delivery_date: '2026-09-11',
        expected_delivery_date: '2026-09-14',
        delay_days: 3,
        current_delay_risk_score: 35,
        risk_level: 'MEDIUM',
        carrier_name: 'Đường sắt Bắc Nam Freight',
        tracking_number: 'DSVN-44123-HN',
      },
      {
        id: 'SHIP-PO-008',
        purchase_order_id: 'po-8',
        po_number: 'PO-2026-008',
        supplier_id: 'SUP-02',
        supplier_name: 'Lucid Motors',
        sku: 'SKU-CAS-07',
        sku_name: 'Bộ giảm tốc hành tinh 1 cấp EV',
        quantity: 50,
        unit: 'bộ',
        destination_warehouse: JSON.stringify(defaultWarehouse),
        promised_delivery_date: '2026-09-10',
        expected_delivery_date: '2026-09-10',
        delay_days: 0,
        current_delay_risk_score: 15,
        risk_level: 'LOW',
        carrier_name: 'Tân Tiến Internal Logistics',
        tracking_number: 'TT-LOG-119',
      },
      {
        id: 'SHIP-PO-011',
        purchase_order_id: 'po-11',
        po_number: 'PO-2026-011',
        supplier_id: 'SUP-03',
        supplier_name: 'Rivian',
        sku: 'SKU-MOT-09',
        sku_name: 'Enduro drive unit & inverter',
        quantity: 120,
        unit: 'cụm',
        destination_warehouse: JSON.stringify(defaultWarehouse),
        promised_delivery_date: '2026-09-11',
        expected_delivery_date: '2026-09-26',
        delay_days: 15,
        current_delay_risk_score: 48,
        risk_level: 'HIGH',
        carrier_name: 'ONE Ocean Network Express',
        tracking_number: 'ONE-88712-LA',
      },
    ];

    for (const s of shipments) {
      await client.query(`
        INSERT INTO shipments (id, purchase_order_id, po_number, supplier_id, supplier_name, sku, sku_name, quantity, unit, destination_warehouse, promised_delivery_date, expected_delivery_date, delay_days, current_delay_risk_score, risk_level, carrier_name, tracking_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          purchase_order_id = EXCLUDED.purchase_order_id,
          po_number = EXCLUDED.po_number,
          supplier_id = EXCLUDED.supplier_id,
          supplier_name = EXCLUDED.supplier_name,
          sku = EXCLUDED.sku,
          sku_name = EXCLUDED.sku_name,
          quantity = EXCLUDED.quantity,
          unit = EXCLUDED.unit,
          destination_warehouse = EXCLUDED.destination_warehouse,
          promised_delivery_date = EXCLUDED.promised_delivery_date,
          expected_delivery_date = EXCLUDED.expected_delivery_date,
          delay_days = EXCLUDED.delay_days,
          current_delay_risk_score = EXCLUDED.current_delay_risk_score,
          risk_level = EXCLUDED.risk_level,
          carrier_name = EXCLUDED.carrier_name,
          tracking_number = EXCLUDED.tracking_number;
      `, [s.id, s.purchase_order_id, s.po_number, s.supplier_id, s.supplier_name, s.sku, s.sku_name, s.quantity, s.unit, s.destination_warehouse, s.promised_delivery_date, s.expected_delivery_date, s.delay_days, s.current_delay_risk_score, s.risk_level, s.carrier_name, s.tracking_number]);
    }

    // 5. SHIPMENT TRACKING POINTS
    console.log('Seeding shipment tracking points...');
    const trackingPoints = [
      { id: 'TP-PO-3-1', shipment_id: 'SHIP-PO-003', purchase_order_id: 'po-3', po_number: 'PO-2026-003', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', latitude: 33.74, longitude: -118.26, location_name: 'Cảng Long Beach (California)', recorded_at: '2026-09-08T08:00:00Z', source: 'CarrierWebhook', speed_kmh: 0, status_note: 'Tàu container Evergreen neo đậu tại phao số 0' },
      { id: 'TP-PO-3-2', shipment_id: 'SHIP-PO-003', purchase_order_id: 'po-3', po_number: 'PO-2026-003', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', latitude: 20.83, longitude: 106.72, location_name: 'Cảng Đình Vũ (Hải Phòng)', recorded_at: '2026-09-10T14:00:00Z', source: 'CarrierWebhook', speed_kmh: 0, status_note: 'Tàu hàng bị cấm nhổ neo do bão số 3' },
      { id: 'TP-PO-3-3', shipment_id: 'SHIP-PO-003', purchase_order_id: 'po-3', po_number: 'PO-2026-003', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', latitude: 20.90, longitude: 106.40, location_name: 'Cao tốc Hà Nội - Hải Phòng (Nút giao Gia Lộc)', recorded_at: '2026-09-11T10:00:00Z', source: 'GPSDevice', speed_kmh: 65, status_note: 'Đoàn xe tải chuyên dụng đang di chuyển' },
      { id: 'TP-PO-7-1', shipment_id: 'SHIP-PO-007', purchase_order_id: 'po-7', po_number: 'PO-2026-007', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', latitude: 10.823, longitude: 106.63, location_name: 'KCN Tân Bình, TP.HCM', recorded_at: '2026-09-10T07:30:00Z', source: 'CarrierWebhook', speed_kmh: 40, status_note: 'Bốc xếp khung hợp kim' },
      { id: 'TP-PO-7-2', shipment_id: 'SHIP-PO-007', purchase_order_id: 'po-7', po_number: 'PO-2026-007', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', latitude: 16.068, longitude: 108.212, location_name: 'Ga Đường sắt Đà Nẵng', recorded_at: '2026-09-11T09:00:00Z', source: 'CarrierWebhook', speed_kmh: 30, status_note: 'Đổi hoa tiêu kỹ thuật đường sắt' },
      { id: 'TP-PO-7-3', shipment_id: 'SHIP-PO-007', purchase_order_id: 'po-7', po_number: 'PO-2026-007', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', latitude: 20.985, longitude: 105.86, location_name: 'Trạm kiểm soát Pháp Vân - Cầu Giẽ', recorded_at: '2026-09-11T15:00:00Z', source: 'GPSDevice', speed_kmh: 55, status_note: 'Mưa lớn, giảm tốc độ an toàn' },
      { id: 'TP-PO-8-1', shipment_id: 'SHIP-PO-008', purchase_order_id: 'po-8', po_number: 'PO-2026-008', supplier_id: 'SUP-02', supplier_name: 'Lucid Motors', latitude: 10.912, longitude: 106.75, location_name: 'Xưởng Tân Tiến (Dĩ An, Bình Dương)', recorded_at: '2026-09-11T06:00:00Z', source: 'CarrierWebhook', speed_kmh: 35, status_note: 'Bắt đầu hành trình Bắc - Nam' },
      { id: 'TP-PO-8-2', shipment_id: 'SHIP-PO-008', purchase_order_id: 'po-8', po_number: 'PO-2026-008', supplier_id: 'SUP-02', supplier_name: 'Lucid Motors', latitude: 21.025, longitude: 105.84, location_name: 'Ga Giáp Bát, Hoàng Mai, Hà Nội', recorded_at: '2026-09-11T14:25:00Z', source: 'CarrierWebhook', speed_kmh: 20, status_note: 'Dỡ container lên xe tải đi KCN Quế Võ' },
      { id: 'TP-PO-6-1', shipment_id: 'SHIP-PO-006', purchase_order_id: 'po-6', po_number: 'PO-2026-006', supplier_id: 'SUP-05', supplier_name: 'TSMC', latitude: 25.079, longitude: 121.234, location_name: 'Sân bay Quốc tế Đào Viên (Taiwan)', recorded_at: '2026-09-11T04:00:00Z', source: 'CarrierWebhook', speed_kmh: 850, status_note: 'Chuyến bay CI5881 cất cánh hướng Nội Bài' },
      { id: 'TP-PO-6-2', shipment_id: 'SHIP-PO-006', purchase_order_id: 'po-6', po_number: 'PO-2026-006', supplier_id: 'SUP-05', supplier_name: 'TSMC', latitude: 21.218, longitude: 105.805, location_name: 'Ga hàng hóa Nội Bài (NCTS)', recorded_at: '2026-09-11T11:40:00Z', source: 'CarrierWebhook', speed_kmh: 40, status_note: 'Hoàn tất thủ tục thông quan luồng xanh' },
      { id: 'TP-PO-4-1', shipment_id: 'SHIP-PO-004', purchase_order_id: 'po-4', po_number: 'PO-2026-004', supplier_id: 'SUP-04', supplier_name: 'General Motors', latitude: 10.932, longitude: 106.854, location_name: 'KCN Biên Hòa 2, Đồng Nai', recorded_at: '2026-09-11T12:00:00Z', source: 'CarrierWebhook', speed_kmh: 35, status_note: 'Xuất xưởng thành phẩm' },
      { id: 'TP-PO-4-2', shipment_id: 'SHIP-PO-004', purchase_order_id: 'po-4', po_number: 'PO-2026-004', supplier_id: 'SUP-04', supplier_name: 'General Motors', latitude: 10.902, longitude: 106.765, location_name: 'Cổng kiểm soát KCN Sóng Thần 2', recorded_at: '2026-09-11T14:40:00Z', source: 'CarrierWebhook', speed_kmh: 15, status_note: 'Chờ bốc dỡ vào Tổng kho Miền Nam' },
      { id: 'TP-PO-5-1', shipment_id: 'SHIP-PO-005', purchase_order_id: 'po-5', po_number: 'PO-2026-005', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', latitude: 21.218, longitude: 105.805, location_name: 'Nhà ga Hàng hóa ALS, Nội Bài', recorded_at: '2026-09-11T11:15:00Z', source: 'CarrierWebhook', speed_kmh: 40, status_note: 'Thủ tục hải quan hàng không hoàn tất' },
      { id: 'TP-PO-5-2', shipment_id: 'SHIP-PO-005', purchase_order_id: 'po-5', po_number: 'PO-2026-005', supplier_id: 'SUP-01', supplier_name: 'Ford Motor', latitude: 21.145, longitude: 106.05, location_name: 'QL18 giao QL1A, TP. Bắc Ninh', recorded_at: '2026-09-11T14:45:00Z', source: 'CarrierWebhook', speed_kmh: 58, status_note: 'Cách nhà máy Bắc Ninh 12km, đúng tiến độ' },
      { id: 'TP-PO-11-1', shipment_id: 'SHIP-PO-011', purchase_order_id: 'po-11', po_number: 'PO-2026-011', supplier_id: 'SUP-03', supplier_name: 'Rivian', latitude: 40.51, longitude: -89.03, location_name: 'Rivian Assembly Plant (Normal, IL)', recorded_at: '2026-09-08T04:00:00Z', source: 'CarrierWebhook', speed_kmh: 60, status_note: 'Xe tải trung chuyển đi Cảng Oakland' },
      { id: 'TP-PO-11-2', shipment_id: 'SHIP-PO-011', purchase_order_id: 'po-11', po_number: 'PO-2026-011', supplier_id: 'SUP-03', supplier_name: 'Rivian', latitude: 37.80, longitude: -122.30, location_name: 'Cảng Oakland (San Francisco Bay)', recorded_at: '2026-09-11T12:00:00Z', source: 'CarrierWebhook', speed_kmh: 0, status_note: 'Hàng chờ xếp dỡ lên tàu vận tải biển' },
    ];

    for (const tp of trackingPoints) {
      await client.query(`
        INSERT INTO shipment_tracking_points (id, shipment_id, purchase_order_id, po_number, supplier_id, supplier_name, latitude, longitude, location_name, recorded_at, source, speed_kmh, status_note)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          location_name = EXCLUDED.location_name,
          recorded_at = EXCLUDED.recorded_at,
          source = EXCLUDED.source,
          speed_kmh = EXCLUDED.speed_kmh,
          status_note = EXCLUDED.status_note;
      `, [tp.id, tp.shipment_id, tp.purchase_order_id, tp.po_number, tp.supplier_id, tp.supplier_name, tp.latitude, tp.longitude, tp.location_name, tp.recorded_at, tp.source, tp.speed_kmh, tp.status_note]);
    }

    // 6. INCIDENTS
    console.log('Seeding incidents...');
    const incidents = [
      {
        id: 'INC-PO-2026-003',
        correlation_id: 'CORR-PO-2026-003-8841',
        po_number: 'PO-2026-003',
        sku: 'SKU-BAT-03',
        sku_name: 'Cell pin LFP 48V (BlueOval SK)',
        supplier_id: 'SUP-01',
        supplier_name: 'Ford Motor',
        delay_days: 15,
        delay_risk_score: 38,
        threshold_applied: 35,
        state: 'APPROVED',
        status: 'Đã duyệt',
        detected_at: '2026-09-11 06:10:00',
        summary: 'PO-2026-003 trễ 15 ngày so với cam kết (lead time 27 ngày). Điểm rủi ro 38/100 vượt ngưỡng 35. Tồn kho SKU-BAT-03 hiện còn 42/80 đơn vị — dự kiến cạn trong 2.3 tuần nếu hàng không về.',
        agent2_triggered: true,
        risk_breakdown: JSON.stringify({
          latenessFactor: 0.5556,
          supplierReliabilityFactor: 0.18,
          inventoryBufferFactor: 0.475,
          w1: 0.5, w2: 0.25, w3: 0.25,
          delayDays: 15, committedLeadTimeDays: 27, currentStock: 42, safetyStock: 80,
          formulaExplanation: 'Score = (0.50 × 0.56) + (0.25 × 0.18) + (0.25 × 0.48) = 38/100.',
        }),
      },
      {
        id: 'INC-PO-2026-009',
        correlation_id: 'CORR-PO-2026-009-3312',
        po_number: 'PO-2026-009',
        sku: 'SKU-BAT-03',
        sku_name: 'Cell pin LFP 48V (BlueOval SK)',
        supplier_id: 'SUP-04',
        supplier_name: 'General Motors',
        delay_days: 12,
        delay_risk_score: 46,
        threshold_applied: 35,
        state: 'SOURCING_BACKUP_SUPPLIERS',
        status: 'Đang tìm nguồn thay thế',
        detected_at: '2026-09-12 06:10:00',
        summary: 'PO-2026-009 trễ 12 ngày. Điểm rủi ro 46/100 vượt ngưỡng 35. Đang kích hoạt thuật toán MILP tìm đối tác dự phòng.',
        agent2_triggered: true,
        risk_breakdown: JSON.stringify({
          latenessFactor: 0.57,
          supplierReliabilityFactor: 0.24,
          inventoryBufferFactor: 0.475,
          w1: 0.5, w2: 0.25, w3: 0.25,
          delayDays: 12, committedLeadTimeDays: 21, currentStock: 42, safetyStock: 80,
          formulaExplanation: 'Score = (0.50 × 0.57) + (0.25 × 0.24) + (0.25 × 0.48) = 46/100.',
        }),
      },
      {
        id: 'INC-PO-2026-011',
        correlation_id: 'CORR-PO-2026-011-7712',
        po_number: 'PO-2026-011',
        sku: 'SKU-MOT-09',
        sku_name: 'Enduro drive unit & inverter',
        supplier_id: 'SUP-03',
        supplier_name: 'Rivian',
        delay_days: 15,
        delay_risk_score: 48,
        threshold_applied: 35,
        state: 'PENDING_APPROVAL',
        status: 'Chờ duyệt',
        detected_at: '2026-09-12 06:10:00',
        summary: 'PO-2026-011 trễ 15 ngày so với cam kết (lead time 27 ngày). Điểm rủi ro 48/100 vượt ngưỡng 35. Tồn kho SKU-MOT-09 hiện còn 31/60 đơn vị, tiêu thụ 10/tuần — dự kiến cạn trong 3.1 tuần nếu hàng không về.',
        agent2_triggered: true,
        risk_breakdown: JSON.stringify({
          latenessFactor: 0.5556,
          supplierReliabilityFactor: 0.32,
          inventoryBufferFactor: 0.4833,
          w1: 0.5, w2: 0.25, w3: 0.25,
          delayDays: 15, committedLeadTimeDays: 27, currentStock: 31, safetyStock: 60,
          formulaExplanation: 'Score = (0.50 × 0.5556) + (0.25 × 0.3200) + (0.25 × 0.4833) = 48/100. Trễ 15 ngày trên lead time cam kết 27 ngày; tồn kho 31/60.',
        }),
      },
    ];

    for (const inc of incidents) {
      await client.query(`
        INSERT INTO incidents (id, correlation_id, po_number, sku, sku_name, supplier_id, supplier_name, delay_days, delay_risk_score, threshold_applied, state, status, detected_at, summary, agent2_triggered, risk_breakdown)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          delay_days = EXCLUDED.delay_days,
          delay_risk_score = EXCLUDED.delay_risk_score,
          threshold_applied = EXCLUDED.threshold_applied,
          state = EXCLUDED.state,
          status = EXCLUDED.status,
          summary = EXCLUDED.summary,
          risk_breakdown = EXCLUDED.risk_breakdown;
      `, [inc.id, inc.correlation_id, inc.po_number, inc.sku, inc.sku_name, inc.supplier_id, inc.supplier_name, inc.delay_days, inc.delay_risk_score, inc.threshold_applied, inc.state, inc.status, inc.detected_at, inc.summary, inc.agent2_triggered, inc.risk_breakdown]);
    }

    // 7. SOURCING PROPOSALS
    console.log('Seeding sourcing proposals...');
    const proposals = [
      {
        id: 'PROP-PO-2026-003',
        incident_id: 'INC-PO-2026-003',
        correlation_id: 'CORR-PO-2026-003-8841',
        po_number: 'PO-2026-003',
        sku: 'SKU-BAT-03',
        sku_name: 'Cell pin LFP 48V (BlueOval SK)',
        quantity: 80,
        original_supplier_name: 'Ford Motor',
        original_unit_price: 9300000,
        original_total_cost: 744000000,
        rankings: JSON.stringify([
          {
            rank: 1,
            supplierId: 'SUP-04',
            supplierName: 'General Motors',
            unitPrice: 9439500,
            totalCost: 755160000,
            leadTimeDays: 30,
            pros: [
              'Chi phí thấp nhất trong các phương án thay thế (755.160.000 VNĐ)',
              'Chênh lệch so với hợp đồng gốc chỉ 1.5% (+11.160.000 VNĐ)',
              'Altman Z = 1.21 nhưng SSI_news 55.7 - mức tin tức trung bình, không có sự kiện đứt gãy nghiêm trọng'
            ],
            cons: [
              'Lead time 30 ngày - chậm hơn hợp đồng gốc 3 ngày',
              'Độ tin cậy giao hàng 76/100 - mức khá nhưng thấp hơn Tesla (82)'
            ],
            score: 60,
            scoreBreakdown: {
              normalizedCost: 1.0,
              normalizedLeadTime: 0.0,
              supplierReliabilityScore: 0.76,
              w1: 0.45, w2: 0.35, w3: 0.20,
              costScoreContribution: 0.45,
              timeScoreContribution: 0.0,
              reliabilityContribution: 0.152
            },
            reasoning: 'Lựa chọn cân bằng tốt nhất: chấp nhận thêm 3 ngày lead time để tiết kiệm 24.552.000 VNĐ so với Tesla, đồng thời bảo vệ biên lợi nhuận của toàn bộ lô 80 pack pin.'
          },
          {
            rank: 2,
            supplierId: 'SUP-06',
            supplierName: 'Tesla',
            unitPrice: 9746400,
            totalCost: 779712000,
            leadTimeDays: 26,
            pros: [
              'Lead time 26 ngày - nhanh hơn nguồn gốc 1 ngày và nhanh hơn GM 4 ngày',
              'Độ tin cậy 82/100 - cao nhất nhóm thay thế',
              'Tình hình tài chính an toàn: Altman Z = 7.15 (vùng an toàn cao), SSI_fin = 10.0'
            ],
            cons: [
              'Đơn giá cao hơn GM 306.900 VNĐ/pack (+4.8% so với hợp đồng gốc, tổng chi thêm 35.712.000 VNĐ)',
              'PORS 52.88 do SSI_news cao (66.5) vì các đợt triệu hồi gần đây'
            ],
            score: 51,
            scoreBreakdown: {
              normalizedCost: 0.0,
              normalizedLeadTime: 1.0,
              supplierReliabilityScore: 0.82,
              w1: 0.45, w2: 0.35, w3: 0.20,
              costScoreContribution: 0.0,
              timeScoreContribution: 0.35,
              reliabilityContribution: 0.164
            },
            reasoning: 'Phương án ưu tiên tốc độ: giao sớm nhất (26 ngày) và tài chính cực mạnh (Z = 7.15), nhưng chi phí cao hơn 24.552.000 VNĐ so với GM khiến điểm MILP tụt xuống 51.'
          }
        ]),
        selected_rank: 1,
        recommendation: 'ĐÃ DUYỆT - chọn General Motors (Rank 1). Chấp nhận phát sinh 11.160.000 VNĐ (+1.5%) để bảo đảm 80 cell pin về trước tuần thứ 3, duy trì hoạt động dây chuyền lắp ráp xe điện.',
        rejected_options_analysis: JSON.stringify([
          { supplierName: 'SUP-02 & SUP-03 (Lucid, Rivian)', reason: 'Không sản xuất cell pin LFP 48V, chỉ cung cấp cụm động cơ và biến tần.' },
          { supplierName: 'SUP-05 (TSMC)', reason: 'Là nhà máy đúc chip bán dẫn, không có năng lực sản xuất cell hóa chất pin.' }
        ]),
        status: 'Đã duyệt',
        total_value_vnd: 755160000,
      },
      {
        id: 'PROP-PO-2026-011',
        incident_id: 'INC-PO-2026-011',
        correlation_id: 'CORR-PO-2026-011-7712',
        po_number: 'PO-2026-011',
        sku: 'SKU-MOT-09',
        sku_name: 'Enduro drive unit & inverter',
        quantity: 120,
        original_supplier_name: 'Rivian',
        original_unit_price: 10494000,
        original_total_cost: 1259280000,
        rankings: JSON.stringify([
          {
            rank: 1,
            supplierId: 'SUP-02',
            supplierName: 'Lucid Motors',
            unitPrice: 10303200,
            totalCost: 1236384000,
            leadTimeDays: 28,
            pros: [
              'Đơn giá thấp hơn hợp đồng gốc 1.82% - tiết kiệm 22.896.000 VNĐ trên toàn đơn',
              'Đã cung cấp đúng SKU-MOT-09 theo lịch sử giá, không cần kiểm định lại khuôn',
              'Lead time 28 ngày, chỉ dài hơn nguồn gốc 1 ngày'
            ],
            cons: [
              'Uy tín giao hàng chỉ 63/100 - thấp nhất trong toàn bộ danh sách nhà cung ứng',
              'CẢNH BÁO TÀI CHÍNH: Altman Z = -4.49 (vùng kiệt quệ), SSI_fin = 100/100',
              'Là nguồn thay thế DUY NHẤT cho SKU-MOT-09 - không còn phương án dự phòng nếu thất bại'
            ],
            score: 91,
            scoreBreakdown: {
              normalizedCost: 1.0,
              normalizedLeadTime: 0.963,
              supplierReliabilityScore: 0.63,
              w1: 0.45, w2: 0.35, w3: 0.20,
              costScoreContribution: 0.45,
              timeScoreContribution: 0.337,
              reliabilityContribution: 0.126
            },
            reasoning: 'Xét thuần chi phí và thời gian thì đây là phương án tốt: rẻ hơn và gần như không mất thêm ngày giao. Nhưng Agent 3 chấm Altman Z = -4.49, tức nhà cung ứng đang ở vùng kiệt quệ tài chính. Điểm 91 phản ánh tiêu chí thương mại, KHÔNG phản ánh rủi ro đối tác.'
          }
        ]),
        selected_rank: 1,
        recommendation: 'Duyệt CÓ ĐIỀU KIỆN. Lucid Motors là nguồn thay thế duy nhất cho SKU-MOT-09 và rẻ hơn 22.896.000 VNĐ, nhưng Altman Z = -4.49 đặt họ trong vùng kiệt quệ. Khuyến nghị: (1) chia đơn 60/120 cho lần giao đầu thay vì giao trọn gói, (2) đàm phán thanh toán sau giao hàng thay vì đặt cọc, (3) song song mở hồ sơ tìm nguồn thứ hai cho SKU-MOT-09 vì hiện đang phụ thuộc sole-source. Tổng giá trị 1.236.384.000 VNĐ - vượt thẩm quyền Trưởng phòng, cần Giám đốc Chuỗi Cung Ứng phê duyệt.',
        rejected_options_analysis: JSON.stringify([
          { supplierName: 'SUP-01, SUP-04, SUP-06 (nhóm pin)', reason: 'Không cung cấp SKU-MOT-09. Danh mục chỉ gồm cell pin LFP/NCMA/4680, không có drive unit hay inverter.' },
          { supplierName: 'SUP-05, SUP-07, SUP-08, SUP-09 (nhóm bán dẫn)', reason: 'Chỉ cung cấp SoC/MCU/FPGA, không có năng lực sản xuất cụm truyền động.' },
          { supplierName: 'SUP-10 (Sony Group)', reason: 'Chỉ cung cấp SKU-SEN-12 (cảm biến hình ảnh).' }
        ]),
        status: 'Chờ duyệt',
        total_value_vnd: 1236384000,
      },
    ];

    for (const p of proposals) {
      await client.query(`
        INSERT INTO sourcing_proposals (id, incident_id, correlation_id, po_number, sku, sku_name, quantity, original_supplier_name, original_unit_price, original_total_cost, rankings, selected_rank, recommendation, rejected_options_analysis, status, total_value_vnd)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          rankings = EXCLUDED.rankings,
          selected_rank = EXCLUDED.selected_rank,
          recommendation = EXCLUDED.recommendation,
          rejected_options_analysis = EXCLUDED.rejected_options_analysis,
          status = EXCLUDED.status,
          total_value_vnd = EXCLUDED.total_value_vnd;
      `, [p.id, p.incident_id, p.correlation_id, p.po_number, p.sku, p.sku_name, p.quantity, p.original_supplier_name, p.original_unit_price, p.original_total_cost, p.rankings, p.selected_rank, p.recommendation, p.rejected_options_analysis, p.status, p.total_value_vnd]);
    }

    // 8. SUPPLIER RISK ANALYSIS (10 suppliers)
    console.log('Seeding supplier risk analysis...');
    const fixtureData = require('D:/Project/ResiliChain/ResiliChain/ai/apidata/out/supplier_risk_fixture.json');
    for (let i = 0; i < fixtureData.suppliers.length; i++) {
      const s = fixtureData.suppliers[i];
      const supId = `SUP-${String(i + 1).padStart(2, '0')}`;
      const pors = s.scores.partial_pors_score ? Number((s.scores.partial_pors_score * 1.15).toFixed(2)) : 45.0;
      const riskLevel = pors >= 55 ? 'CAO' : (pors >= 40 ? 'TRUNG BÌNH' : 'THẤP');
      const statusLabel = s.status || 'Bình thường';

      await client.query(`
        INSERT INTO supplier_risk_analysis (supplier_id, ticker, ssi_news, ssi_fin, g_geo, ssi_del, altman_z, pors_score, risk_level, status_label, events_supply_chain_30d, key_events, analyzed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (supplier_id) DO UPDATE SET
          ticker = EXCLUDED.ticker,
          ssi_news = EXCLUDED.ssi_news,
          ssi_fin = EXCLUDED.ssi_fin,
          g_geo = EXCLUDED.g_geo,
          ssi_del = EXCLUDED.ssi_del,
          altman_z = EXCLUDED.altman_z,
          pors_score = EXCLUDED.pors_score,
          risk_level = EXCLUDED.risk_level,
          status_label = EXCLUDED.status_label,
          events_supply_chain_30d = EXCLUDED.events_supply_chain_30d,
          key_events = EXCLUDED.key_events,
          analyzed_at = NOW();
      `, [supId, s.ticker, s.scores.ssi_news, s.scores.ssi_fin, s.scores.geo_political, 18.0, s.scores.altman_z, pors, riskLevel, statusLabel, s.events_30d?.supply_chain_related || 0, JSON.stringify(s.key_events || [])]);
    }

    // 9. AI JOB RUNS
    console.log('Seeding ai_job_runs...');
    const jobRuns = [
      { job_name: 'order_risk_scan', trigger_source: 'schedule', started_at: '2026-09-12 06:00:00', finished_at: '2026-09-12 06:00:15', duration_ms: 15420, status: 'SUCCESS', orders_scanned: 15, suppliers_scanned: 10, incidents_created: 1, incidents_updated: 2, proposals_created: 1, skipped_locked: 0, message: 'Hoàn tất quét định kỳ 15 đơn hàng. Phát hiện 1 nguy cơ mới trễ hạn.' },
      { job_name: 'supplier_risk_scan', trigger_source: 'schedule', started_at: '2026-09-12 00:00:00', finished_at: '2026-09-12 00:02:40', duration_ms: 160000, status: 'SUCCESS', orders_scanned: 0, suppliers_scanned: 10, incidents_created: 0, incidents_updated: 0, proposals_created: 0, skipped_locked: 0, message: 'Hoàn tất cập nhật radar tài chính FMP và tin tức GDELT cho 10 nhà cung ứng.' },
      { job_name: 'order_risk_scan', trigger_source: 'manual', started_at: '2026-09-12 07:15:00', finished_at: '2026-09-12 07:15:08', duration_ms: 8320, status: 'SUCCESS', orders_scanned: 15, suppliers_scanned: 10, incidents_created: 0, incidents_updated: 1, proposals_created: 0, skipped_locked: 1, message: 'Bỏ qua 1 incident đã có quyết định của con người (INC-PO-2026-003).' },
    ];

    for (const jr of jobRuns) {
      await client.query(`
        INSERT INTO ai_job_runs (job_name, trigger_source, started_at, finished_at, duration_ms, status, orders_scanned, suppliers_scanned, incidents_created, incidents_updated, proposals_created, skipped_locked, message)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
      `, [jr.job_name, jr.trigger_source, jr.started_at, jr.finished_at, jr.duration_ms, jr.status, jr.orders_scanned, jr.suppliers_scanned, jr.incidents_created, jr.incidents_updated, jr.proposals_created, jr.skipped_locked, jr.message]);
    }

    await client.query('COMMIT');
    console.log('✅ Successfully seeded all database tables!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed, rolled back:', err);
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
