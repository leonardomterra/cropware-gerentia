import type { ReactNode } from "react";
import { Logo, LogoName } from "@/components/Logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Shell das telas de auth (login, signup, forgot, reset). Espelha o
 * padrao do Cropware CDM (logo + tagline + Card branco), so a paleta
 * vai de green pra slate.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2.5 text-center">
          <Logo className="h-12 w-auto" />
          <LogoName className="h-4 w-auto" />
        </div>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle style={{ fontSize: "16px", fontWeight: 600 }}>
              {title}
            </CardTitle>
            {subtitle ? (
              <CardDescription
                style={{
                  fontSize: "14px",
                  fontWeight: 400,
                  color: "#94a3b8",
                }}
              >
                {subtitle}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
