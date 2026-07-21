import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { createLogger } from "@/lib/logger";


const logger = createLogger("NotFound");
const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Página no encontrada</p>
        <a href="/" className="text-primary underline transition-colors hover:text-primary/80">
          Volver al inicio
        </a>
      </div>
    </div>
  );
};

export default NotFound;
