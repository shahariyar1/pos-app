"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/fetcher";
import { SHOP_ADDRESS, SHOP_NAME, SHOP_PHONES } from "@/lib/shop";
import { loginSchema, registerFormSchema, type LoginFormValues, type RegisterFormValues } from "@/lib/validations";

function LoginForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), defaultValues: { id: "", password: "" } });

  async function onSubmit(values: LoginFormValues) {
    try {
      await api("/api/portal/login", { method: "POST", body: JSON.stringify(values) });
      router.push("/shop");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Shop name or phone number" htmlFor="l-id" error={errors.id?.message}>
        <Input id="l-id" autoComplete="username" aria-invalid={!!errors.id} {...register("id")} />
      </Field>
      <Field label="Password" htmlFor="l-pw" error={errors.password?.message}>
        <Input id="l-pw" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { shopName: "", address: "", phone: "", password: "", confirm: "" },
  });

  async function onSubmit({ confirm: _confirm, ...values }: RegisterFormValues) {
    try {
      await api("/api/portal/register", { method: "POST", body: JSON.stringify(values) });
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Shop name" htmlFor="r-shop" error={errors.shopName?.message}>
        <Input id="r-shop" autoComplete="organization" aria-invalid={!!errors.shopName} {...register("shopName")} />
      </Field>
      <Field label="Shop address" htmlFor="r-address" error={errors.address?.message}>
        <Input id="r-address" autoComplete="street-address" aria-invalid={!!errors.address} {...register("address")} />
      </Field>
      <Field
        label="Phone number (optional now)"
        htmlFor="r-phone"
        error={errors.phone?.message}
        hint="You need it when you place an order. We only use it for your orders and never send spam."
      >
        <Input id="r-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" aria-invalid={!!errors.phone} {...register("phone")} />
      </Field>
      <Field label="Password" htmlFor="r-pw" error={errors.password?.message}>
        <Input id="r-pw" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      <Field label="Type the password again" htmlFor="r-pw2" error={errors.confirm?.message}>
        <Input id="r-pw2" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
      </Field>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Create my account"}
      </Button>
    </form>
  );
}

/** Customer front door: log in, or sign up (the shop approves new accounts). */
export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [sent, setSent] = useState(false);

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-primary">{SHOP_NAME}</h1>
          <p className="text-sm text-muted-foreground">Order online from your shop</p>
        </div>

        <Card>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="space-y-3 text-center" aria-live="polite">
                <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
                <h2 className="text-lg font-semibold">We got your request</h2>
                <p className="text-sm text-muted-foreground">
                  {SHOP_NAME} will check and approve your account. After that you can log in and place orders. You can call {SHOP_PHONES} to speed it up.
                </p>
                <Button
                  className="w-full"
                  onClick={() => {
                    setSent(false);
                    setMode("login");
                  }}
                >
                  Go to login
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-1 rounded-lg border bg-muted/40 p-1" role="tablist" aria-label="Login or sign up">
                  <Button role="tab" aria-selected={mode === "login"} className="flex-1" size="sm" variant={mode === "login" ? "default" : "ghost"} onClick={() => setMode("login")}>
                    Log in
                  </Button>
                  <Button role="tab" aria-selected={mode === "register"} className="flex-1" size="sm" variant={mode === "register" ? "default" : "ghost"} onClick={() => setMode("register")}>
                    New customer
                  </Button>
                </div>
                {mode === "login" ? <LoginForm /> : <RegisterForm onDone={() => setSent(true)} />}
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {SHOP_ADDRESS} · {SHOP_PHONES}
          <br />
          <a href="/owner-login" className="underline">
            Owner login
          </a>
        </p>
      </div>
    </main>
  );
}
