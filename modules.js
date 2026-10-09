// ═══════════════════════════════════════════════════════════════════════
// modules.js — Auto Lab registry: SYSTEMS and their MODULES in ONE file.
//
// ADD A NEW MODULE  →  add one object inside the "modules" list of the
// system it belongs to (order in the list = learning order). Nothing else.
//
//   id        unique key (URLs, messages, localStorage)
//   label     short name on the card
//   title     full title in the module header
//   subtitle  category · sub-line
//   file      relative path to the module HTML
//   color     accent colour (hex)
//   icon      raw SVG inner markup (24×24, stroke-based)
//   level     'Basic' | 'Intermediate' | 'Advanced'      (default Basic)
//   min       estimated minutes                          (default 10)
//   mode      '3D' | '2D' | '2D + 3D'                    (default 3D)
//
// ADD A NEW SYSTEM  →  add an object to SYSTEMS below:
//   id, domain (one of DOMAINS), title, color, icon, blurb,
//   flow     ["Label"] or ["Label|moduleId"]  (clickable step)
//   soon     roadmap cards shown dimmed        related  other system ids
//   modules  the list of module objects
// ═══════════════════════════════════════════════════════════════════════

const DOMAINS = ["Engine", "Electrical & Control", "Drivetrain", "Chassis"];

const SYSTEMS = [
  {
    id: "engine",
    domain: "Engine",
    title: "Engine Mechanical",
    color: "#38bdf8",
    blurb: "The four-stroke cycle, valvetrain and moving parts that turn fuel into rotation.",
    icon: "<circle cx=\"12\" cy=\"15\" r=\"4\"/><line x1=\"12\" y1=\"11\" x2=\"12\" y2=\"7\"/><rect x=\"9\" y=\"3\" width=\"6\" height=\"4\" rx=\"1\"/><line x1=\"4\" y1=\"20\" x2=\"20\" y2=\"20\"/>",
    flow: ["Cycle|engine", "Valvetrain|valvetrain", "Crank|crankpiston", "Combustion|engine"],
    soon: [],
    related: ["fuel", "ignition", "lube"],
    modules: [
      {"id": "engine", "label": "Engine", "title": "4-Stroke Engine", "subtitle": "Automotive · Cycle & Valvetrain", "file": "engine.html", "color": "#38bdf8", "level": "Basic", "min": 12, "mode": "3D", "icon": "<circle cx=\"12\" cy=\"15\" r=\"4\"/><line x1=\"12\" y1=\"11\" x2=\"12\" y2=\"7\"/><rect x=\"9\" y=\"3\" width=\"6\" height=\"4\" rx=\"1\"/><line x1=\"4\" y1=\"20\" x2=\"20\" y2=\"20\"/>"},
      {"id": "valvetrain", "label": "Valvetrain", "title": "Valvetrain", "subtitle": "Engine Mechanical · Cam, Lifters & Valves", "file": "valvetrain.html", "color": "#d946ef", "level": "Intermediate", "min": 14, "mode": "3D", "icon": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 9V4M9 12H4M12 15v5M15 12h5\"/>"},
      {"id": "crankpiston", "label": "Crank & Pistons", "title": "Crankshaft & Pistons", "subtitle": "Engine Mechanical · Crank, Rods & Rings", "file": "crankshaft-piston.html", "color": "#ca8a04", "level": "Basic", "min": 12, "mode": "3D", "icon": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><line x1=\"9\" y1=\"12\" x2=\"3\" y2=\"12\"/><line x1=\"15\" y1=\"12\" x2=\"21\" y2=\"12\"/><line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"4\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"20\"/>"}
    ]
  },
  {
    id: "air",
    domain: "Engine",
    title: "Air Intake & Boost",
    color: "#fb7185",
    blurb: "Getting more air into the cylinders: filtering, compressing and cooling the charge.",
    icon: "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"2.5\" fill=\"currentColor\"/><line x1=\"12\" y1=\"4\" x2=\"12\" y2=\"9.5\"/><line x1=\"12\" y1=\"14.5\" x2=\"12\" y2=\"20\"/><line x1=\"4\" y1=\"12\" x2=\"9.5\" y2=\"12\"/><line x1=\"14.5\" y1=\"12\" x2=\"20\" y2=\"12\"/>",
    flow: ["Air filter|airfilter", "Compressor|turbo", "Intercooler|intercooler", "Throttle", "Cylinder"],
    soon: [],
    related: ["exhaust", "fuel"],
    modules: [
      {"id": "airfilter", "label": "Air Filter", "title": "Air Filter & Intake", "subtitle": "Air Intake · Filtration & Airflow", "file": "airfilter.html", "color": "#fb7185", "level": "Basic", "min": 10, "mode": "3D", "icon": "<rect x=\"4\" y=\"6\" width=\"16\" height=\"12\" rx=\"2\"/><path d=\"M8 6v12M12 6v12M16 6v12\"/>"},
      {"id": "turbo", "label": "Turbo", "title": "Turbocharger", "subtitle": "Forced Induction · Boost", "file": "turbocharger.html", "color": "#fb7185", "level": "Advanced", "min": 15, "mode": "3D", "icon": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"2.5\" fill=\"currentColor\"/><line x1=\"12\" y1=\"4\" x2=\"12\" y2=\"9.5\"/><line x1=\"12\" y1=\"14.5\" x2=\"12\" y2=\"20\"/><line x1=\"4\" y1=\"12\" x2=\"9.5\" y2=\"12\"/><line x1=\"14.5\" y1=\"12\" x2=\"20\" y2=\"12\"/>"},
      {"id": "intercooler", "label": "Intercooler", "title": "Intercooler", "subtitle": "Air Intake · Charge-Air Cooling", "file": "intercooler.html", "color": "#38bdf8", "level": "Intermediate", "min": 12, "mode": "3D", "icon": "<rect x=\"5\" y=\"4\" width=\"14\" height=\"16\" rx=\"2\"/><path d=\"M5 8h14M5 12h14M5 16h14\"/>"}
    ]
  },
  {
    id: "fuel",
    domain: "Engine",
    title: "Fuel Supply",
    color: "#10b981",
    blurb: "Storing, delivering and metering fuel: from the tank to the cylinder.",
    icon: "<rect x=\"9\" y=\"3\" width=\"6\" height=\"5\" rx=\"1\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"13\"/><path d=\"M8 17l4-4 4 4M9 21h6\"/>",
    flow: ["Tank|fuelpump", "Pump|fuelpump", "Filter|fuelpump", "Carburetor|carburetor", "Injector|mpfi", "Rail|commonrail", "Cylinder"],
    soon: [],
    related: ["sensors", "air", "ignition"],
    modules: [
      {"id": "fuelpump", "label": "Fuel Pump", "title": "Fuel Pump & Tank", "subtitle": "Fuel System · Tank, Pump & Filter", "file": "fuelpump.html", "color": "#10b981", "level": "Basic", "min": 11, "mode": "3D", "icon": "<rect x=\"4\" y=\"8\" width=\"12\" height=\"11\" rx=\"2\"/><path d=\"M16 11h2.5a1.5 1.5 0 0 1 1.5 1.5V16M8 8V5h4v3\"/>"},
      {"id": "carburetor", "label": "Carb", "title": "Carburetor", "subtitle": "Fuel System · Venturi", "file": "carburetor.html", "color": "#f59e0b", "level": "Basic", "min": 10, "mode": "3D", "icon": "<path d=\"M12 3c-3 5-6 8-6 11a6 6 0 0 0 12 0c0-3-3-6-6-11z\"/>"},
      {"id": "mpfi", "label": "Injection", "title": "Electronic Fuel Injection (MPFI)", "subtitle": "Fuel System · Port / Common Rail", "file": "mpfi.html", "color": "#10b981", "level": "Intermediate", "min": 14, "mode": "3D", "icon": "<rect x=\"9\" y=\"3\" width=\"6\" height=\"5\" rx=\"1\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"13\"/><path d=\"M8 17l4-4 4 4M9 21h6\"/>"},
      {"id": "commonrail", "label": "Common Rail", "title": "Diesel Common Rail", "subtitle": "Fuel System · High-Pressure Diesel", "file": "commonrail.html", "color": "#f97316", "level": "Advanced", "min": 15, "mode": "3D", "icon": "<path d=\"M3 8h18M6 8v6M10 8v6M14 8v6M18 8v6\"/><path d=\"M6 17v2M10 17v2M14 17v2M18 17v2\"/>"}
    ]
  },
  {
    id: "ignition",
    domain: "Engine",
    title: "Ignition",
    color: "#f97316",
    blurb: "Creating and timing the spark that starts combustion.",
    icon: "<path d=\"M13 2L3 14h7l-1 8 10-12h-7l1-8z\"/>",
    flow: ["Battery", "Coil|coilplug", "Timing|ignition", "Spark plug|sparkplug", "Cylinder"],
    soon: [],
    related: ["elec", "sensors", "engine"],
    modules: [
      {"id": "ignition", "label": "Ignition", "title": "Ignition System", "subtitle": "Electrical · Coil & Timing", "file": "ignition.html", "color": "#f97316", "level": "Intermediate", "min": 12, "mode": "3D", "icon": "<path d=\"M13 2L3 14h7l-1 8 10-12h-7l1-8z\"/>"},
      {"id": "sparkplug", "label": "Spark Plug", "title": "Spark Plugs", "subtitle": "Ignition · Electrodes & Gap", "file": "sparkplug.html", "color": "#facc15", "level": "Basic", "min": 10, "mode": "3D", "icon": "<path d=\"M9 3h6M12 3v5M8 8h8l-1 5H9zM12 13v5M12 18l-2 3M12 18l2 3\"/>"},
      {"id": "coilplug", "label": "Coil-on-Plug", "title": "Coil-on-Plug Ignition", "subtitle": "Ignition · Individual Coils", "file": "coilplug.html", "color": "#f97316", "level": "Intermediate", "min": 12, "mode": "3D", "icon": "<rect x=\"8\" y=\"3\" width=\"8\" height=\"11\" rx=\"2\"/><path d=\"M12 14v4M10 21h4M12 18l-2 3\"/>"}
    ]
  },
  {
    id: "lube",
    domain: "Engine",
    title: "Lubrication",
    color: "#84cc16",
    blurb: "Oil circulation that reduces friction, carries heat and protects bearings.",
    icon: "<path d=\"M12 3c-2 3-5 7-5 10a5 5 0 0 0 10 0c0-3-3-7-5-10z\"/><circle cx=\"12\" cy=\"14\" r=\"2\"/>",
    flow: ["Sump", "Pump|oilpump", "Filter|oilfilter", "Gallery", "Bearings"],
    soon: [],
    related: ["cooling", "engine"],
    modules: [
      {"id": "lubrication", "label": "Lubrication", "title": "Lubrication System", "subtitle": "Engine · Oil Grades & Wear", "file": "lubrication.html", "color": "#84cc16", "level": "Basic", "min": 10, "mode": "3D", "icon": "<path d=\"M12 3c-2 3-5 7-5 10a5 5 0 0 0 10 0c0-3-3-7-5-10z\"/><circle cx=\"12\" cy=\"14\" r=\"2\"/>"},
      {"id": "oilpump", "label": "Oil Pump", "title": "Oil Pump Types", "subtitle": "Lubrication · Gear Pump & Relief Valve", "file": "oilpump.html", "color": "#84cc16", "level": "Intermediate", "min": 12, "mode": "3D", "icon": "<circle cx=\"9\" cy=\"12\" r=\"4\"/><circle cx=\"16\" cy=\"12\" r=\"4\"/><path d=\"M12 3v4M12 17v4\"/>"},
      {"id": "oilfilter", "label": "Oil Filter", "title": "Oil Filters", "subtitle": "Lubrication · Element & Bypass Valve", "file": "oilfilter.html", "color": "#eab308", "level": "Basic", "min": 10, "mode": "3D", "icon": "<rect x=\"7\" y=\"4\" width=\"10\" height=\"16\" rx=\"3\"/><path d=\"M7 9h10M7 14h10\"/>"}
    ]
  },
  {
    id: "cooling",
    domain: "Engine",
    title: "Cooling",
    color: "#06b6d4",
    blurb: "Removing excess heat and holding the engine at its best operating temperature.",
    icon: "<path d=\"M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z\"/>",
    flow: ["Engine block", "Thermostat|thermostat", "Radiator|radiator", "Water pump|cooling"],
    soon: [],
    related: ["lube", "sensors"],
    modules: [
      {"id": "cooling", "label": "Cooling", "title": "Cooling System", "subtitle": "Engine Cooling · Air / Liquid", "file": "cooling.html", "color": "#06b6d4", "level": "Basic", "min": 10, "mode": "3D", "icon": "<path d=\"M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z\"/>"},
      {"id": "thermostat", "label": "Thermostat", "title": "Thermostat", "subtitle": "Cooling · Wax Element Valve", "file": "thermostat.html", "color": "#f59e0b", "level": "Basic", "min": 10, "mode": "3D", "icon": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 8v4l3 2\"/>"},
      {"id": "radiator", "label": "Radiator", "title": "Radiator", "subtitle": "Cooling · Core, Fan & Airflow", "file": "radiator.html", "color": "#06b6d4", "level": "Basic", "min": 11, "mode": "3D", "icon": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"14\" rx=\"2\"/><path d=\"M8 5v14M12 5v14M16 5v14\"/>"}
    ]
  },
  {
    id: "exhaust",
    domain: "Engine",
    title: "Exhaust & Emissions",
    color: "#78909c",
    blurb: "Carrying burnt gases away, cleaning them and quieting the noise.",
    icon: "<path d=\"M3 14h4l2-6 4 10 3-6h5\"/><circle cx=\"6\" cy=\"17\" r=\"1.2\"/><circle cx=\"20\" cy=\"17\" r=\"1.2\"/>",
    flow: ["Manifold|exhaustsystem", "EGR|egr", "Catalyst|catalytic", "DPF|dpf", "Muffler|exhaustsystem", "Tailpipe|exhaustsystem"],
    soon: [],
    related: ["air", "sensors"],
    modules: [
      {"id": "exhaustsystem", "label": "Exhaust", "title": "Exhaust System", "subtitle": "Emissions · Silencer & Catalyst", "file": "exhaustsystem.html", "color": "#78909c", "level": "Basic", "min": 10, "mode": "3D", "icon": "<path d=\"M3 14h4l2-6 4 10 3-6h5\"/><circle cx=\"6\" cy=\"17\" r=\"1.2\"/><circle cx=\"20\" cy=\"17\" r=\"1.2\"/>"},
      {"id": "catalytic", "label": "Catalytic", "title": "Catalytic Converter", "subtitle": "Emissions · Three-Way Catalyst", "file": "catalytic.html", "color": "#fb923c", "level": "Intermediate", "min": 13, "mode": "3D", "icon": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"4\"/><path d=\"M8 8v8M12 8v8M16 8v8\"/>"},
      {"id": "egr", "label": "EGR", "title": "Exhaust Gas Recirculation", "subtitle": "Emissions · EGR Valve & Cooler", "file": "egr.html", "color": "#a78bfa", "level": "Intermediate", "min": 12, "mode": "3D", "icon": "<path d=\"M4 8h12l4 4-4 4H4\"/><path d=\"M8 12h8\"/>"},
      {"id": "dpf", "label": "DPF", "title": "Diesel Particulate Filter", "subtitle": "Emissions · Soot Trap & Regeneration", "file": "dpf.html", "color": "#94a3b8", "level": "Advanced", "min": 14, "mode": "3D", "icon": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"3\"/><path d=\"M7 8v3M11 13v3M15 8v3M19 13v3\"/>"}
    ]
  },
  {
    id: "elec",
    domain: "Electrical & Control",
    title: "Electrical & Starting",
    color: "#fbbf24",
    blurb: "Battery, starter and alternator: storing, using and regenerating electrical energy.",
    icon: "<rect x=\"3\" y=\"8\" width=\"14\" height=\"8\" rx=\"1.5\"/><line x1=\"17\" y1=\"10\" x2=\"21\" y2=\"10\"/><line x1=\"17\" y1=\"14\" x2=\"21\" y2=\"14\"/><line x1=\"5\" y1=\"10\" x2=\"5\" y2=\"14\"/><line x1=\"9\" y1=\"10\" x2=\"9\" y2=\"14\"/>",
    flow: ["Battery|electrical", "Wiring|wiring", "Starter|starting", "Alternator|electrical", "Lamps|lighting"],
    soon: [],
    related: ["ignition", "sensors"],
    modules: [
      {"id": "electrical", "label": "Electrical", "title": "Battery · Starter · Alternator", "subtitle": "Electrical · Charging", "file": "electrical.html", "color": "#fbbf24", "level": "Basic", "min": 12, "mode": "3D", "icon": "<rect x=\"3\" y=\"8\" width=\"14\" height=\"8\" rx=\"1.5\"/><line x1=\"17\" y1=\"10\" x2=\"21\" y2=\"10\"/><line x1=\"17\" y1=\"14\" x2=\"21\" y2=\"14\"/><line x1=\"5\" y1=\"10\" x2=\"5\" y2=\"14\"/><line x1=\"9\" y1=\"10\" x2=\"9\" y2=\"14\"/>"},
      {"id": "starting", "label": "Starting", "title": "Starting System", "subtitle": "Electrical · Starter Motor", "file": "starting-system.html", "color": "#818cf8", "level": "Basic", "min": 10, "mode": "3D", "icon": "<rect x=\"2\" y=\"8\" width=\"11\" height=\"8\" rx=\"2\"/><line x1=\"13\" y1=\"12\" x2=\"17\" y2=\"12\"/><circle cx=\"19.5\" cy=\"12\" r=\"2\"/><path d=\"M6.5 10l-1.2 3h2.4l-1.2 3\"/>"},
      {"id": "lighting", "label": "Lighting", "title": "Vehicle Lighting", "subtitle": "Electrical · Headlamp & Relay Circuit", "file": "lighting.html", "color": "#fde047", "level": "Basic", "min": 11, "mode": "3D", "icon": "<path d=\"M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z\"/>"},
      {"id": "wiring", "label": "Wiring", "title": "Wiring Harness", "subtitle": "Electrical · Fuse, Relay & Load", "file": "wiring.html", "color": "#f43f5e", "level": "Intermediate", "min": 13, "mode": "3D", "icon": "<path d=\"M3 8h6l3 8h6\"/><circle cx=\"19\" cy=\"16\" r=\"2\"/><circle cx=\"4\" cy=\"8\" r=\"1.4\"/>"}
    ]
  },
  {
    id: "sensors",
    domain: "Electrical & Control",
    title: "Sensors & Control",
    color: "#22c55e",
    blurb: "How sensors, the ECU and actuators work together to manage the engine.",
    icon: "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M6 12a6 6 0 0 1 12 0M3 12a9 9 0 0 1 18 0\"/>",
    flow: ["Sensors|sensors", "ECU|ecu", "Diagnostics|obd2", "Actuators", "Engine"],
    soon: [],
    related: ["fuel", "ignition", "elec"],
    modules: [
      {"id": "sensors", "label": "Sensors", "title": "Sensors & Wiring", "subtitle": "Electrical · Sensing & Control", "file": "sensors.html", "color": "#22c55e", "level": "Intermediate", "min": 15, "mode": "2D + 3D", "icon": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M6 12a6 6 0 0 1 12 0M3 12a9 9 0 0 1 18 0\"/>"},
      {"id": "ecu", "label": "ECU", "title": "Engine Control Unit", "subtitle": "Sensors & Control · Inputs → Maps → Outputs", "file": "ecu.html", "color": "#a855f7", "level": "Advanced", "min": 15, "mode": "3D", "icon": "<rect x=\"4\" y=\"6\" width=\"16\" height=\"12\" rx=\"2\"/><rect x=\"8\" y=\"9\" width=\"8\" height=\"6\" rx=\"1\"/><line x1=\"2\" y1=\"10\" x2=\"4\" y2=\"10\"/><line x1=\"2\" y1=\"14\" x2=\"4\" y2=\"14\"/><line x1=\"20\" y1=\"10\" x2=\"22\" y2=\"10\"/><line x1=\"20\" y1=\"14\" x2=\"22\" y2=\"14\"/>"},
      {"id": "obd2", "label": "OBD-II", "title": "OBD-II Diagnostics", "subtitle": "Sensors & Control · Scan Tool, Faults & Live Data", "file": "obd2.html", "color": "#22d3ee", "level": "Intermediate", "min": 12, "mode": "3D", "icon": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"2\"/><circle cx=\"8\" cy=\"12\" r=\"1\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"16\" cy=\"12\" r=\"1\"/>"}
    ]
  },
  {
    id: "drive",
    domain: "Drivetrain",
    title: "Transmission & Drivetrain",
    color: "#3b82f6",
    blurb: "Carrying engine power through clutch, gears and differential to the wheels.",
    icon: "<rect x=\"3\" y=\"9\" width=\"8\" height=\"6\" rx=\"1\"/><rect x=\"13\" y=\"9\" width=\"8\" height=\"6\" rx=\"1\"/><line x1=\"11\" y1=\"12\" x2=\"13\" y2=\"12\"/>",
    flow: ["Engine", "Clutch|clutch", "Gearbox|gearbox", "Driveshaft|driveshaft", "Differential|differential", "AWD|awd", "Wheels"],
    soon: [],
    related: ["engine", "chassis"],
    modules: [
      {"id": "transmission", "label": "Trans", "title": "Transmission System", "subtitle": "Drivetrain · 2W / 4W", "file": "transmission.html", "color": "#3b82f6", "level": "Basic", "min": 10, "mode": "3D", "icon": "<rect x=\"3\" y=\"9\" width=\"8\" height=\"6\" rx=\"1\"/><rect x=\"13\" y=\"9\" width=\"8\" height=\"6\" rx=\"1\"/><line x1=\"11\" y1=\"12\" x2=\"13\" y2=\"12\"/>"},
      {"id": "clutch", "label": "Clutch", "title": "Clutch", "subtitle": "Transmission · Friction Disc", "file": "clutch.html", "color": "#e11d48", "level": "Basic", "min": 10, "mode": "3D", "icon": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"6\"/><line x1=\"12\" y1=\"18\" x2=\"12\" y2=\"21\"/><line x1=\"3\" y1=\"12\" x2=\"6\" y2=\"12\"/><line x1=\"18\" y1=\"12\" x2=\"21\" y2=\"12\"/>"},
      {"id": "gearbox", "label": "Gearbox", "title": "Manual Gearbox", "subtitle": "Transmission · H-Pattern", "file": "gearbox.html", "color": "#22c55e", "level": "Intermediate", "min": 14, "mode": "3D", "icon": "<line x1=\"6\" y1=\"4\" x2=\"6\" y2=\"20\"/><line x1=\"12\" y1=\"4\" x2=\"12\" y2=\"12\"/><line x1=\"18\" y1=\"4\" x2=\"18\" y2=\"12\"/><line x1=\"12\" y1=\"12\" x2=\"18\" y2=\"12\"/>"},
      {"id": "automatic", "label": "Auto", "title": "Automatic Transmission", "subtitle": "Drivetrain · Torque Converter", "file": "automatic.html", "color": "#2dd4bf", "level": "Advanced", "min": 16, "mode": "3D", "icon": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><line x1=\"12\" y1=\"4\" x2=\"12\" y2=\"9\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"20\"/><line x1=\"4\" y1=\"12\" x2=\"9\" y2=\"12\"/><line x1=\"15\" y1=\"12\" x2=\"20\" y2=\"12\"/>"},
      {"id": "differential", "label": "Diff", "title": "Differential", "subtitle": "Drivetrain · Torque Split", "file": "differential.html", "color": "#eab308", "level": "Intermediate", "min": 12, "mode": "3D", "icon": "<circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"12\" r=\"3\"/><line x1=\"9\" y1=\"12\" x2=\"15\" y2=\"12\"/><line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"6\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"18\"/>"},
      {"id": "driveshaft", "label": "Driveshaft", "title": "Driveshafts & U-Joints", "subtitle": "Drivetrain · Cardan Joint & Speed Variation", "file": "driveshaft.html", "color": "#38bdf8", "level": "Intermediate", "min": 12, "mode": "3D", "icon": "<path d=\"M3 12h7M14 12h7\"/><path d=\"M10 8l4 8M14 8l-4 8\"/>"},
      {"id": "awd", "label": "4WD / AWD", "title": "4WD / AWD Systems", "subtitle": "Drivetrain · Transfer Case & Torque Split", "file": "awd.html", "color": "#22c55e", "level": "Advanced", "min": 15, "mode": "3D", "icon": "<circle cx=\"6\" cy=\"7\" r=\"2.5\"/><circle cx=\"18\" cy=\"7\" r=\"2.5\"/><circle cx=\"6\" cy=\"17\" r=\"2.5\"/><circle cx=\"18\" cy=\"17\" r=\"2.5\"/><path d=\"M6 9.5v5M18 9.5v5M8.5 12h7\"/>"}
    ]
  },
  {
    id: "chassis",
    domain: "Chassis",
    title: "Steering, Suspension & Brakes",
    color: "#a855f7",
    blurb: "Directing the vehicle, absorbing the road and bringing it safely to a stop.",
    icon: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"2.5\"/><line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"9.5\"/><line x1=\"4.5\" y1=\"16.5\" x2=\"9.9\" y2=\"13.2\"/><line x1=\"19.5\" y1=\"16.5\" x2=\"14.1\" y2=\"13.2\"/>",
    flow: ["Driver", "Steering|steering", "Suspension|suspension", "Tyres|tyres", "Alignment|wheel-alignment", "Balancing|wheel-balancing", "Brakes|braking", "ABS|absesc"],
    soon: [],
    related: ["drive"],
    modules: [
      {"id": "steering", "label": "Steering", "title": "Steering System", "subtitle": "Steering · Rack & Pinion", "file": "steering.html", "color": "#a855f7", "level": "Basic", "min": 12, "mode": "3D", "icon": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"2.5\"/><line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"9.5\"/><line x1=\"4.5\" y1=\"16.5\" x2=\"9.9\" y2=\"13.2\"/><line x1=\"19.5\" y1=\"16.5\" x2=\"14.1\" y2=\"13.2\"/>"},
      {"id": "suspension", "label": "Suspension", "title": "Suspension System", "subtitle": "Chassis · Springs & Dampers", "file": "suspension.html", "color": "#ec4899", "level": "Basic", "min": 12, "mode": "3D", "icon": "<path d=\"M7 3h10M7 21h10M6 3c0 3 12 3 12 6s-12 3-12 6 12 3 12 6\"/>"},
      {"id": "braking", "label": "Brakes", "title": "Hydraulic Braking System", "subtitle": "Chassis · Disc & Drum", "file": "braking.html", "color": "#ef4444", "level": "Intermediate", "min": 14, "mode": "3D", "icon": "<circle cx=\"11\" cy=\"12\" r=\"7\"/><circle cx=\"11\" cy=\"12\" r=\"2.5\"/><rect x=\"16\" y=\"8\" width=\"4\" height=\"8\" rx=\"1\"/>"},
      {"id": "absesc", "label": "ABS & ESC", "title": "ABS & Electronic Stability Control", "subtitle": "Chassis · Wheel Speed, Slip & Yaw Control", "file": "abs-esc.html", "color": "#f43f5e", "level": "Advanced", "min": 15, "mode": "3D", "icon": "<circle cx=\"11\" cy=\"12\" r=\"7\"/><circle cx=\"11\" cy=\"12\" r=\"2.5\"/><rect x=\"16\" y=\"8\" width=\"4\" height=\"8\" rx=\"1\"/><path d=\"M18 4l1.5 2h-3z\"/>"},
      {"id": "tyres", "label": "Wheels & Tyres", "title": "Wheels & Tyres", "subtitle": "Chassis · Pressure, Contact Patch & Wear", "file": "tyres.html", "color": "#64748b", "level": "Basic", "min": 11, "mode": "3D", "icon": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 3v5M12 16v5M3 12h5M16 12h5\"/>"},
      {"id": "wheel-alignment", "label": "Wheel Alignment", "title": "Wheel Alignment", "subtitle": "Chassis · Toe, Camber & Caster", "file": "Wheel alignment/wheel-alignment.html", "color": "#14b8a6", "level": "Intermediate", "min": 15, "mode": "3D", "icon": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 4v16M5 12h14\"/><path d=\"M8 6l-2 12M16 6l2 12\"/>"},
      {"id": "wheel-balancing", "label": "Wheel Balancing", "title": "Wheel Balancing", "subtitle": "Chassis · Static & Dynamic Balance", "file": "Wheel balancing/wheel-balancing.html", "color": "#ef4444", "level": "Intermediate", "min": 14, "mode": "3D", "icon": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M12 3v3M12 18v3\"/><circle cx=\"12\" cy=\"4.5\" r=\"1.3\"/>"}
    ]
  }
];

/* ── Derived globals used by the shell (do not edit) ─────────────────── */
window.AUTO_DOMAINS = DOMAINS;
window.AUTO_MODULES = [];
window.AUTO_META    = {};
window.AUTO_SYSTEMS = SYSTEMS.map(function (s) {
  s.modules.forEach(function (m) {
    window.AUTO_MODULES.push(m);
    window.AUTO_META[m.id] = [m.level || 'Basic', m.min || 10, m.mode || '3D'];
  });
  return Object.assign({}, s, { modules: s.modules.map(function (m) { return m.id; }) });
});
