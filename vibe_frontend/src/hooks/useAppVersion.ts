import { useState, useEffect } from "react";

export function useAppVersion() {
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    // In web mode, use package.json version or environment variable
    setAppVersion("1.0.0");
  }, []);

  return appVersion;
}
