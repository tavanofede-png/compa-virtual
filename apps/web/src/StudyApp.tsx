"use client";
import { useState, useEffect, useRef } from "react";
import {
  Home,
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
import { emptySnapshot, destinations } from "@compa/domain";
import { AppContext } from "./context";
import { Pages } from "./Pages";
import { Forms, titles } from "./Forms";
import { Creature } from "./Room";
import { Field, formData } from "./ui";
import { Landing } from "./Landing";
import { CompanionSetup } from "./CompanionSetup";
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
const navIcons = {
  room: Home,
  agenda: CalendarDays,
  study: BookOpen,
  progress: Trophy,
  compa: Sparkles,
};
const navigation = destinations.map((item) => ({
  ...item,
  icon: navIcons[item.id],
}));
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
  const [authReady, setAuthReady] = useState(!backend);
  const account = useRef<string | undefined>(undefined);
  const s = env.state;
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("demo") === "1") {
      setAuthReady(true);
      setRepo(createDemo(storage));
      return;
    }
    if (!backend) return;
    let alive = true;
    const apply = (id?: string) => {
      if (alive) {
        setAuthReady(true);
        if (account.current === id) return;
        account.current = id;
        setLoaded(false);
        setEnv({ state: emptySnapshot(), version: 0 });
        setModal(null);
        setRepo(id ? createRepository(backend, storage, id) : null);
      }
    };
    backend.auth
      .getSession()
      .then(({ data, error }) => {
        if (error && alive)
          setError("No pudimos recuperar tu sesión. Intentá entrar de nuevo.");
        apply(data.session?.user.id);
      })
      .catch(() => {
        if (alive) setAuthReady(true);
      });
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
    let alive = true;
    setLoaded(false);
    repo
      .load()
      .then((data) => {
        if (!alive) return;
        setEnv(data);
        setLoaded(true);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [repo]);
  useEffect(() => {
    const restoreView = () => {
      const v = new URLSearchParams(location.search).get("view");
      if (
        v &&
        [...navigation.map((x) => x.id), "today", "memory", "together"].includes(v as never)
      )
        setView(v);
      setModal(null);
    };
    restoreView();
    window.addEventListener("popstate", restoreView);
    return () => window.removeEventListener("popstate", restoreView);
  }, []);
  const go = (name: string) => {
    setView(name);
    setMobileNav(false);
    if (new URLSearchParams(location.search).get("view") !== name)
      history.pushState(null, "", "?view=" + name);
    window.scrollTo({ top: 0 });
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
  if (!authReady)
    return (
      <main className="session-loading" role="status">
        Recuperando tu espacio…
      </main>
    );
  if (
    repo &&
    loaded &&
    modal !== "password" &&
    (!s.profile?.onboarding_complete ||
      !s.companion.character_id ||
      modal === "companion")
  )
    return (
      <CompanionSetup
        key={modal === "companion" ? "editor" : "welcome"}
        repo={repo}
        env={env}
        update={setEnv}
        editing={
          modal === "companion" &&
          !!s.profile?.onboarding_complete &&
          !!s.companion.character_id
        }
        onExit={() => {
          if (modal === "companion") setModal(null);
          else void leave();
        }}
        onComplete={() => {
          setModal(null);
          go("room");
          setNotice("Tu compa está listo. Podés cambiarlo desde Personalizar.");
        }}
      />
    );
  if (!repo)
    return (
      <Landing
        register={() => {
          setAuthMode("register");
          open("auth");
        }}
        login={() => {
          setAuthMode("login");
          open("auth");
        }}
        demo={() => {
          setRepo(createDemo(storage));
          go("room");
        }}
        onboarding={() => setRepo(createDemo(storage, { onboarding: true }))}
      >
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
                      const { data, error } = await backend.auth.signUp({
                        email: d.email,
                        password: d.password,
                        options: { emailRedirectTo: location.origin },
                      });
                      if (error) throw error;
                      if (data.session) {
                        setModal(null);
                        setNotice("");
                      } else
                        setNotice(
                          "Revisá tu correo y confirmá la cuenta. Al volver vas a elegir tu compa.",
                        );
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
      </Landing>
    );
  return (
    <AppContext.Provider
      value={{
        modal,
        repo,
        env,
        busy,
        open,
        go,
        run,
        command,
        update: setEnv,
        close: () => setModal(null),
        leave,
        notice: setNotice,
      }}
    >
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          Saltar al contenido
        </a>
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
                  (view === id || (id === "study" && view === "together") ? "active " : "") + (i === 4 ? "separated" : "")
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
              <strong>{view === "together" ? "Estudiar juntos" : navigation.find((x) => x.id === view)?.label}</strong>
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
          <div id="main-content" className="page-content">
            {loaded ? (
              <Pages view={view} />
            ) : (
              <div role="status">
                <p>Preparando tu espacio…</p>
                {error && (
                  <button
                    className="secondary"
                    onClick={() =>
                      run(async () => {
                        const data = await repo.load();
                        setEnv(data);
                        setLoaded(true);
                      })
                    }
                  >
                    Reintentar
                  </button>
                )}
              </div>
            )}
          </div>
          <footer className="footer">
            <span>compa virtual · hecho para aprender a tu ritmo</span>
            <button className="text-button" onClick={() => open("privacy")}>
              Privacidad y tus datos ↗
            </button>
          </footer>
        </main>
        <nav className="bottom-nav" aria-label="Navegación principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={
                view === id ||
                (id === "study" && view === "together") ||
                (id === "room" && view === "today") ||
                (id === "compa" && view === "memory")
                  ? "active"
                  : ""
              }
              aria-current={
                view === id ||
                (id === "study" && view === "together") ||
                (id === "room" && view === "today") ||
                (id === "compa" && view === "memory")
                  ? "page"
                  : undefined
              }
              onClick={() => go(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
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
