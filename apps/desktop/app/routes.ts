import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("./routes/studio.tsx"),
  route(":tab", "./routes/studio-tab.tsx"),
] satisfies RouteConfig;
