"use client";
import { useState, useEffect } from "react";
import {
  Home,
  Sun,
  CalendarDays,
  BookOpen,
  Trophy,
  Sparkles,
  Settings2,
  ChevronRight,
  Bell,
  Menu,
  X,
  Coins,
  MessageCircle,
  ArrowRight,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  createBackend,
  createDemo,
  createRepository,
  type Repository,
  type Envelope,
} from "@compa/client";
import { emptySnapshot } from "@compa/domain";
import { AppContext } from "./context";
import { Pages } from "./Pages";
import { Forms, titles } from "./Forms";
import { Room, Creature } from "./Room";
import { Field, formData } from "./ui";
const storage = {
  getItem: async (k: string) => localStorage.getItem(k),
  setItem: async (k: string, v: string) => {
    localStorage.setItem(k, v);
  },
  removeItem: async (k: string) => {
    localStorage.removeItem(k);
  },
};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const backend = url && key ? createBackend(url, key) : null;
const navigation = [
  { icon: Home, id: "room", label: "Mi habitación" },
  { icon: Sun, id: "today", label: "Hoy" },
  { icon: CalendarDays, id: "agenda", label: "Agenda" },
  { icon: BookOpen, id: "study", label: "Estudiar" },
  { icon: Trophy, id: "progress", label: "Mis logros" },
  { icon: Sparkles, id: "memory", label: "Memoria académica" },
];
export default function StudyApp() {
  const [repo, setRepo] = useState<Repository | null>(null),
    [env, setEnv] = useState<Envelope>({ state: emptySnapshot(), version: 0 }),
    [view, setView] = useState("room"),
    [modal, setModal] = useState<string | null>(null),
    [selected, setSelected] = useState<unknown>(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [authMode, setAuthMode] = useState("login"),
    [loaded, setLoaded] = useState(false);
  const s = env.state;
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (!backend) return;
    let alive = true;
    const apply = (id?: string) => {
      if (alive) {
        setLoaded(false);
        setRepo(id ? createRepository(backend, storage, id) : null);
      }
    };
    backend.auth.getSession().then(({ data }) => apply(data.session?.user.id));
    const { data } = backend.auth.onAuthStateChange((event, session) => {
      apply(session?.user.id);
      if (event === "PASSWORD_RECOVERY") setModal("password");
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!repo) return;
    repo
      .load()
      .then((data) => {
        setEnv(data);
        setLoaded(true);
        if (!data.state.profile) setModal("profile");
      })
      .catch((e) => setError(e.message));
  }, [repo]);
  useEffect(() => {
    const v = new URLSearchParams(location.search).get("view");
    if (navigation.some((x) => x.id === v)) setView(v!);
  }, []);
  const go = (name: string) => {
    setView(name);
    setMobileNav(false);
    history.replaceState(null, "", "?view=" + name);
  };
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la acción.",
      );
    } finally {
      setBusy(false);
    }
  };
  const open = (name: string, value?: unknown) => {
    setError("");
    setSelected(value);
    setModal(name);
  };
  const command = async (type: string, payload: unknown, close = true) => {
    if (!repo) return;
    setEnv(await repo.command({ type, payload }, env.version));
    if (close) setModal(null);
  };
  const leave = () =>
    run(async () => {
      if (repo) await repo.signOut();
      setRepo(null);
      setEnv({ state: emptySnapshot(), version: 0 });
      setModal(null);
    });
  const feedback = (
    <>
      {notice && (
        <div role="status" className="toast">
          {notice}
          <button aria-label="Cerrar aviso" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
    </>
  );
  if (!repo)
    return (
      <main className="welcome">
        <div className="welcome-copy">
          <div className="brand">
            <span className="brand-mark">c.</span>compa virtual
            <span className="beta">BETA</span>
          </div>
          <p className="eyebrow">UN PASO A LA VEZ</p>
          <h1>
            Tu mundo.
            <br />
            Tu manera
            <br />
            de aprender.
          </h1>
          <p>
            Un compa para organizar la semana, entender lo difícil y celebrar lo
            que vas aprendiendo.
          </p>
          <button
            className="primary"
            onClick={() => setRepo(createDemo(storage))}
          >
            Explorar con datos ficticios <ArrowRight size={18} />
          </button>
          <small>Demostración local · Sin registro · Sin IA conectada</small>
          <button className="text-button" onClick={() => open("auth")}>
            Ya tengo una cuenta / Registrarme <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="welcome-scene">
          <Room
            companion={s.companion}
            onTalk={() => setRepo(createDemo(storage))}
          />
          <div className="welcome-note">
            <span>✦</span>
            <p>
              No hace falta hacer todo hoy.
              <br />
              <strong>Hagamos lugar para el próximo paso.</strong>
            </p>
          </div>
        </div>
        <Dialog
          open={modal === "auth"}
          onOpenChange={(v) => {
            if (!v) setModal(null);
          }}
        >
          <DialogContent className="compa-modal">
            <DialogTitle>
              {authMode === "register"
                ? "Crear tu cuenta"
                : authMode === "reset"
                  ? "Recuperar acceso"
                  : "Volver a tu espacio"}
            </DialogTitle>
            <DialogDescription>
              Tu cuenta mantiene tu progreso entre dispositivos.
            </DialogDescription>
            {!backend ? (
              <p className="callout">
                Este entorno todavía no tiene Supabase configurado. Podés
                explorar la demostración mientras se conecta el backend.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  const d = formData(e);
                  run(async () => {
                    if (authMode === "reset") {
                      const { error } =
                        await backend.auth.resetPasswordForEmail(d.email, {
                          redirectTo: location.origin,
                        });
                      if (error) throw error;
                      setNotice("Revisá tu correo para recuperar el acceso.");
                    } else if (authMode === "register") {
                      const { error } = await backend.auth.signUp({
                        email: d.email,
                        password: d.password,
                        options: { emailRedirectTo: location.origin },
                      });
                      if (error) throw error;
                      setNotice("Revisá tu correo para confirmar tu cuenta.");
                    } else {
                      const { error } = await backend.auth.signInWithPassword({
                        email: d.email,
                        password: d.password,
                      });
                      if (error) throw error;
                      setModal(null);
                    }
                  });
                }}
              >
                <Field label="Correo">
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </Field>
                {authMode !== "reset" && (
                  <Field label="Contraseña">
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      autoComplete={
                        authMode === "register"
                          ? "new-password"
                          : "current-password"
                      }
                      required
                    />
                  </Field>
                )}
                <button className="primary" disabled={busy}>
                  {authMode === "register"
                    ? "Registrarme"
                    : authMode === "reset"
                      ? "Enviar correo"
                      : "Entrar"}
                </button>
                <div className="inline">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setAuthMode(
                        authMode === "register" ? "login" : "register",
                      )
                    }
                  >
                    {authMode === "register" ? "Tengo cuenta" : "Crear cuenta"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setAuthMode("reset")}
                  >
                    Olvidé mi contraseña
                  </button>
                </div>
              </form>
            )}
            {feedback}
          </DialogContent>
        </Dialog>
      </main>
    );
  return (
    <AppContext.Provider
      value={{
        repo,
        env,
        busy,
        open,
        go,
        run,
        command,
        update: setEnv,
        close: () => setModal(null),
        notice: setNotice,
      }}
    >
      <div className="app-shell">
        <aside className={"sidebar " + (mobileNav ? "is-open" : "")}>
          <a
            className="brand"
            href="?view=room"
            onClick={(e) => {
              e.preventDefault();
              go("room");
            }}
          >
            <span className="brand-mark">c.</span>
            <span>
              compa
              <br />
              virtual
            </span>
          </a>
          <span className="sidebar-label">MI ESPACIO</span>
          <nav>
            {navigation.map(({ icon: Icon, id, label }, i) => (
              <button
                className={
                  (view === id ? "active " : "") + (i === 4 ? "separated" : "")
                }
                key={id}
                onClick={() => go(id)}
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="mini-compa">
              <Creature companion={s.companion} size={68} />
              <div>
                <strong>{s.companion.name}</strong>
                <span>Un paso a la vez</span>
              </div>
            </div>
            <button className="profile-button" onClick={() => open("settings")}>
              <span className="avatar">
                {s.profile?.nickname.charAt(0) || "A"}
              </span>
              <div>
                <strong>{s.profile?.nickname ?? "Tu perfil"}</strong>
                <small>{s.profile?.school_year ?? "–"}.º de secundaria</small>
              </div>
              <Settings2 size={17} />
            </button>
            <button className="text-button signout" onClick={leave}>
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </aside>
        <main className="workspace">
          <header className="topbar">
            <button
              className="mobile-toggle icon-button"
              aria-label="Abrir navegación"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Mi espacio <ChevronRight size={13} />{" "}
              <strong>{navigation.find((x) => x.id === view)?.label}</strong>
            </span>
            <div className="topbar-actions">
              <span className="coin-pill">
                <Coins size={16} />
                {s.coins}
                <span>monedas</span>
              </span>
              <button
                className="icon-button"
                aria-label="Notificaciones"
                onClick={() => open("notifications")}
              >
                <Bell size={19} />
              </button>
              <button
                className="avatar"
                aria-label="Ajustes"
                onClick={() => open("settings")}
              >
                {s.profile?.nickname.charAt(0) || "A"}
              </button>
            </div>
          </header>
          {repo.mode === "demo" && (
            <div className="demo-banner">
              <span>
                Datos ficticios · La IA y los archivos requieren una cuenta
                conectada.
              </span>
              <button onClick={leave}>
                Salir de la demo <X size={13} />
              </button>
            </div>
          )}
          {env.offline && (
            <div className="demo-banner">
              Sin conexión. Consultá la última copia guardada; las acciones
              requieren internet.
            </div>
          )}
          {!modal && feedback}
          <div className="page-content">
            {loaded ? (
              <Pages view={view} />
            ) : (
              <p role="status">Preparando tu espacio…</p>
            )}
          </div>
          <footer className="footer">
            <span>compa virtual · hecho para aprender a tu ritmo</span>
            <button className="text-button" onClick={() => open("privacy")}>
              Privacidad y tus datos ↗
            </button>
          </footer>
        </main>
        <button
          className="chat-launcher"
          onClick={() => open("chat")}
          aria-label="Hablar con mi compañero"
        >
          <MessageCircle size={21} />
          <span>Hablemos</span>
        </button>
        <Dialog
          open={!!modal}
          onOpenChange={(v) => {
            if (!v && !busy) setModal(null);
          }}
        >
          <DialogContent
            className={
              "compa-modal " +
              (["plan", "week", "quiz", "companion"].includes(modal ?? "")
                ? "wide"
                : "")
            }
          >
            <DialogTitle>
              {modal === "password"
                ? "Elegí una nueva contraseña"
                : (titles[modal ?? ""] ?? "Compa Virtual")}
            </DialogTitle>
            <DialogDescription>
              {modal === "plan"
                ? "Revisá horarios y objetivos. Nada cambia hasta que aceptes."
                : "Un paso a la vez. Podés volver cuando lo necesites."}
            </DialogDescription>
            {feedback}
            {modal === "password" ? (
              <form
                onSubmit={(e) => {
                  const d = formData(e);
                  run(async () => {
                    if (d.password.length < 12)
                      throw Error("Usá al menos 12 caracteres.");
                    const { error } = await backend!.auth.updateUser({
                      password: d.password,
                    });
                    if (error) throw error;
                    setModal(null);
                    setNotice("Contraseña actualizada.");
                  });
                }}
              >
                <Field label="Nueva contraseña">
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <button className="primary" disabled={busy}>
                  Guardar contraseña
                </button>
              </form>
            ) : (
              modal && (
                <Forms
                  key={modal + JSON.stringify(selected)}
                  name={modal}
                  selected={selected}
                />
              )
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppContext.Provider>
  );
}
