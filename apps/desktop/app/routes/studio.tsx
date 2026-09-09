import App from "../../src/App";
import { AppProviders } from "../../src/providers/AppProviders";

export default function Studio() {
  return (
    <AppProviders>
      <App />
    </AppProviders>
  );
}
