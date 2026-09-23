const http = require("http");

const PORT = parseInt(process.env.AUDIT_MOCK_PORT || "8000", 10);
const HOST = "127.0.0.1";

const MOCK_BATCH = {
  id: 1,
  code: "KB-2026-000001",
  kiln_id: 10,
  kiln_name_snapshot: "Horno grande",
  firing_type: "LOW",
  scheduled_date: "2026-09-25",
  status: "PLANNED",
  capacity_snapshot_cm3: "240000",
  assigned_volume_cm3: "12000",
  occupancy_percent: "5.0",
  available_percent: "95.0",
  available_cm3: "228000",
  exclusive: false,
  version: 1,
  notes: "Hornada de prueba para auditoría",
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  kiln_width_cm_snapshot: "60.000000",
  kiln_depth_cm_snapshot: "50.000000",
  kiln_height_cm_snapshot: "80.000000",
  assignments: [
    {
      id: 101,
      batch_id: 1,
      source_kind: "V2_QUOTATION",
      production_order_id: 5,
      internal_load_id: null,
      line_id: 1,
      product_name: "Taza de café",
      quantity: 2,
      unit_volume_cm3: "810",
      assigned_volume_cm3: "1620",
      firing_mode: "SHARED",
    },
    {
      id: 102,
      batch_id: 1,
      source_kind: "V2_QUOTATION",
      production_order_id: 5,
      internal_load_id: null,
      line_id: 2,
      product_name: "Plato hondo",
      quantity: 1,
      unit_volume_cm3: "1200",
      assigned_volume_cm3: "1200",
      firing_mode: "SHARED",
    },
  ],
};

const MOCK_LAYOUT = {
  id: 10,
  batch_id: 1,
  version: 1,
  kiln_width_cm_snapshot: "60.000000",
  kiln_depth_cm_snapshot: "50.000000",
  kiln_height_cm_snapshot: "80.000000",
  placed_quantity: 1,
  pending_quantity: 2,
  levels: [
    {
      level_index: 0,
      name: "Piso 1 - Base",
      z_cm: "0.000000",
      usable_height_cm: "25.000000",
      plate_label: "Placa A",
      plate_thickness_cm: "1.500000",
    },
    {
      level_index: 1,
      name: "Piso 2 - Superior",
      z_cm: "26.500000",
      usable_height_cm: "50.000000",
      plate_label: "Placa B",
      plate_thickness_cm: "1.500000",
    },
  ],
  placements: [
    {
      id: 1,
      batch_assignment_id: 101,
      group_index: 0,
      unit_index: 1,
      quantity: 1,
      level_index: 0,
      x_cm: "5.000000",
      y_cm: "5.000000",
      rotation_degrees: 0,
      piece_length_cm_snapshot: "9.000000",
      piece_width_cm_snapshot: "9.000000",
      piece_height_cm_snapshot: "10.000000",
      separation_cm_snapshot: "2.000000",
    },
  ],
};

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || "http://localhost:4173";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token, Cookie, Authorization");

  if (req.method === "OPTIONS") {
    console.log(`AUDIT_MOCK_REQUEST ${req.method} ${req.url}`);
    res.writeHead(204);
    res.end();
    return;
  }

  res.setHeader("Content-Type", "application/json");

  // Health check
  if (req.url === "/health" || req.url === "/api/v1/health") {
    console.log(`AUDIT_MOCK_REQUEST ${req.method} ${req.url}`);
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", service: "kiln-layout-audit-mock" }));
    return;
  }

  // Auth CSRF
  if (req.url.includes("/api/v1/auth/csrf")) {
    console.log(`AUDIT_MOCK_REQUEST ${req.method} ${req.url}`);
    res.writeHead(200);
    res.end(JSON.stringify({ csrf_token: "mock-csrf-token", expires_in: 28800 }));
    return;
  }

  // Auth me
  if (req.url.includes("/api/v1/auth/me")) {
    console.log(`AUDIT_MOCK_REQUEST ${req.method} ${req.url}`);
    res.writeHead(200);
    res.end(
      JSON.stringify({
        authenticated: true,
        user: {
          id: "11111111-2222-3333-4444-555555555555",
          email: "admin@empresa.com",
          display_name: "Administrador",
          role: "ADMIN",
        },
      }),
    );
    return;
  }

  // Company settings
  if (req.url.includes("/api/v1/settings/company")) {
    console.log(`AUDIT_MOCK_REQUEST ${req.method} ${req.url}`);
    res.writeHead(200);
    res.end(JSON.stringify({ logo: null }));
    return;
  }

  // Kiln batch details
  if (req.url.includes("/api/v1/kiln-batches/1/layout/suggest")) {
    console.log(`AUDIT_MOCK_REQUEST ${req.method} ${req.url}`);
    res.writeHead(200);
    res.end(
      JSON.stringify({
        batch_id: 1,
        base_version: 1,
        total_pending: 1,
        suggested_count: 1,
        unplaced_count: 0,
        levels_used: [0],
        suggested_placements: [
          {
            batch_assignment_id: 101,
            group_index: 0,
            unit_index: 2,
            quantity: 1,
            level_index: 0,
            x_cm: "18.000000",
            y_cm: "5.000000",
            rotation_degrees: 0,
            piece_length_cm_snapshot: "9.000000",
            piece_width_cm_snapshot: "9.000000",
            piece_height_cm_snapshot: "10.000000",
            separation_cm_snapshot: "2.000000",
          },
        ],
        unplaced_pieces: [],
      }),
    );
    return;
  }

  // Kiln batch layout (GET / PUT)
  if (req.url.includes("/api/v1/kiln-batches/1/layout")) {
    console.log(`AUDIT_MOCK_REQUEST ${req.method} ${req.url}`);
    res.writeHead(200);
    res.end(JSON.stringify(MOCK_LAYOUT));
    return;
  }

  // Kiln batch
  if (req.url.includes("/api/v1/kiln-batches/1")) {
    console.log(`AUDIT_MOCK_REQUEST ${req.method} ${req.url}`);
    res.writeHead(200);
    res.end(JSON.stringify(MOCK_BATCH));
    return;
  }

  // Unhandled endpoints
  console.warn(`AUDIT_MOCK_UNHANDLED ${req.method} ${req.url}`);
  res.writeHead(404);
  res.end(JSON.stringify({ detail: "Endpoint no mockeado en audit server" }));
});

server.listen(PORT, HOST, () => {
  console.log(`KILN_LAYOUT_AUDIT_MOCK_READY http://${HOST}:${PORT}`);
});

function shutdown() {
  console.log("\nKILN_LAYOUT_AUDIT_MOCK_STOPPING");
  server.close(() => {
    console.log("KILN_LAYOUT_AUDIT_MOCK_STOPPED");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
