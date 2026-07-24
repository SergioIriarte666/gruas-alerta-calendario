import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  FileWarning,
  Headphones,
  History,
  LayoutDashboard,
  MapPin,
  Menu,
  Moon,
  Navigation,
  PackageCheck,
  Plus,
  ReceiptText,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import "./portal-alternatives.css";

type DesignId = "control" | "executive" | "journey";
type PreviewTheme = "light" | "dark";

const designs: Array<{
  id: DesignId;
  letter: string;
  name: string;
  summary: string;
}> = [
  {
    id: "control",
    letter: "A",
    name: "Centro de control",
    summary: "Operación visible y acciones urgentes primero",
  },
  {
    id: "executive",
    letter: "B",
    name: "Cuenta ejecutiva",
    summary: "Lectura financiera sobria y documental",
  },
  {
    id: "journey",
    letter: "C",
    name: "Ruta de servicio",
    summary: "Experiencia guiada, amable y mobile-first",
  },
];

const services = [
  {
    folio: "SRV-2841",
    route: "Quilicura → San Antonio",
    date: "Hoy · 12:30",
    vehicle: "Camión Volvo · LKBR-72",
    status: "En ruta",
    tone: "live",
    value: "$385.000",
  },
  {
    folio: "SRV-2836",
    route: "Pudahuel → Rancagua",
    date: "22 jul · 09:15",
    vehicle: "Ram 700 · PLTF-19",
    status: "Completado",
    tone: "success",
    value: "$248.000",
  },
  {
    folio: "SRV-2829",
    route: "Maipú → Valparaíso",
    date: "19 jul · 16:40",
    vehicle: "Bus Mercedes · RPKD-44",
    status: "Esperando O.C.",
    tone: "warning",
    value: "$510.000",
  },
];

const invoices = [
  {
    folio: "F-10482",
    date: "Vence 29 jul",
    value: "$1.240.000",
    status: "Pendiente",
    tone: "warning",
  },
  {
    folio: "F-10397",
    date: "Venció 18 jul",
    value: "$685.000",
    status: "Vencida",
    tone: "danger",
  },
  {
    folio: "F-10281",
    date: "Pagada 12 jul",
    value: "$920.000",
    status: "Pagada",
    tone: "success",
  },
];

const IconButton = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <button className="lab-icon-button" type="button" aria-label={label} title={label}>
    {children}
  </button>
);

const Status = ({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: string;
}) => <span className={`lab-status lab-status--${tone}`}>{children}</span>;

const Brand = ({ compact = false }: { compact?: boolean }) => (
  <div className={`lab-brand ${compact ? "lab-brand--compact" : ""}`}>
    <span className="lab-brand__mark">
      <Truck aria-hidden="true" />
    </span>
    <span className="lab-brand__copy">
      <strong>GRÚAS ALERTA</strong>
      <small>Portal clientes</small>
    </span>
  </div>
);

const ControlCenter = () => (
  <section className="concept concept-a" aria-label="Alternativa A, Centro de control">
    <aside className="a-sidebar">
      <Brand />
      <nav className="a-nav" aria-label="Navegación principal">
        <p>OPERACIÓN</p>
        <a className="is-active" href="#inicio">
          <LayoutDashboard /> <span>Resumen</span>
        </a>
        <a href="#servicios">
          <Route /> <span>Mis servicios</span>
          <b>27</b>
        </a>
        <a href="#solicitar">
          <Plus /> <span>Solicitar servicio</span>
        </a>
        <p>ADMINISTRACIÓN</p>
        <a href="#oc">
          <FileWarning /> <span>Órdenes de compra</span>
          <b className="is-warning">2</b>
        </a>
        <a href="#facturas">
          <ReceiptText /> <span>Facturas</span>
        </a>
      </nav>
      <div className="a-support">
        <Headphones />
        <div>
          <small>¿Necesitas ayuda?</small>
          <strong>Soporte 24/7</strong>
        </div>
        <ChevronRight />
      </div>
      <div className="a-account">
        <span>CM</span>
        <div>
          <strong>Camila Morales</strong>
          <small>Acme Logística SpA</small>
        </div>
        <ChevronDown />
      </div>
    </aside>

    <div className="a-main">
      <header className="a-topbar">
        <button className="a-mobile-menu" type="button" aria-label="Abrir menú">
          <Menu />
        </button>
        <div className="a-search">
          <Search />
          <span>Buscar servicio, factura o patente…</span>
          <kbd>⌘ K</kbd>
        </div>
        <div className="a-topbar__right">
          <span className="a-live"><i /> Operación en línea</span>
          <IconButton label="Notificaciones">
            <Bell />
            <i className="lab-notification-dot" />
          </IconButton>
          <div className="a-avatar">CM</div>
        </div>
      </header>

      <div className="a-content">
        <div className="a-heading">
          <div>
            <span className="lab-eyebrow">JUEVES, 23 DE JULIO</span>
            <h1>Buenas noches, Camila.</h1>
            <p>Tu operación está al día. Hay 2 documentos que necesitan atención.</p>
          </div>
          <button className="lab-primary-button" type="button">
            <Plus /> Solicitar servicio
          </button>
        </div>

        <div className="a-overview-grid">
          <article className="a-live-service">
            <div className="a-live-service__head">
              <div>
                <span className="a-kicker"><i /> SERVICIO EN CURSO</span>
                <h2>Quilicura <ArrowRight /> San Antonio</h2>
              </div>
              <Status tone="live">En ruta</Status>
            </div>
            <div className="a-route-visual">
              <div className="a-route-point is-origin">
                <span />
                <div>
                  <small>ORIGEN · 12:34</small>
                  <strong>Av. Presidente Frei Montalva 9700</strong>
                </div>
              </div>
              <div className="a-route-track">
                <i style={{ width: "62%" }} />
                <span style={{ left: "60%" }}>
                  <Truck />
                </span>
              </div>
              <div className="a-route-point is-destination">
                <span />
                <div>
                  <small>DESTINO · LLEGADA 14:35</small>
                  <strong>Puerto de San Antonio, acceso norte</strong>
                </div>
              </div>
            </div>
            <div className="a-live-service__foot">
              <div className="a-driver">
                <span>JR</span>
                <div>
                  <small>Operador</small>
                  <strong>José Rojas · Grúa G-07</strong>
                </div>
              </div>
              <button className="lab-secondary-button" type="button">
                <Navigation /> Seguir en mapa
              </button>
            </div>
          </article>

          <div className="a-metrics">
            <article>
              <span className="a-metric-icon a-metric-icon--primary">
                <Route />
              </span>
              <div>
                <strong>27</strong>
                <small>Servicios este mes</small>
              </div>
              <em>+12%</em>
            </article>
            <article>
              <span className="a-metric-icon a-metric-icon--warning">
                <FileWarning />
              </span>
              <div>
                <strong>2</strong>
                <small>Órdenes pendientes</small>
              </div>
              <em className="is-warning">Revisar</em>
            </article>
            <article>
              <span className="a-metric-icon a-metric-icon--danger">
                <CircleDollarSign />
              </span>
              <div>
                <strong>$1,9M</strong>
                <small>Saldo por pagar</small>
              </div>
              <em className="is-danger">1 vencida</em>
            </article>
          </div>
        </div>

        <div className="a-lower-grid">
          <article className="a-panel a-services">
            <div className="lab-panel-heading">
              <div>
                <span className="lab-eyebrow">ACTIVIDAD RECIENTE</span>
                <h3>Últimos servicios</h3>
              </div>
              <button type="button">Ver todos <ArrowRight /></button>
            </div>
            <div className="a-service-list">
              {services.slice(1).map((service) => (
                <div className="a-service-row" key={service.folio}>
                  <span className="a-service-row__icon"><Truck /></span>
                  <div className="a-service-row__main">
                    <strong>{service.route}</strong>
                    <small>{service.folio} · {service.vehicle}</small>
                  </div>
                  <div>
                    <strong>{service.value}</strong>
                    <small>{service.date}</small>
                  </div>
                  <Status tone={service.tone}>{service.status}</Status>
                  <ChevronRight />
                </div>
              ))}
            </div>
          </article>

          <article className="a-panel a-attention">
            <div className="lab-panel-heading">
              <div>
                <span className="lab-eyebrow">BANDEJA DE ACCIÓN</span>
                <h3>Requiere tu atención</h3>
              </div>
              <span className="a-count">3</span>
            </div>
            <div className="a-task">
              <span className="a-task__icon"><FileWarning /></span>
              <div>
                <strong>2 servicios sin O.C.</strong>
                <small>Adjunta los documentos para facturar.</small>
              </div>
              <button type="button">Resolver</button>
            </div>
            <div className="a-task">
              <span className="a-task__icon is-danger"><ReceiptText /></span>
              <div>
                <strong>Factura F-10397 vencida</strong>
                <small>Venció hace 5 días · $685.000</small>
              </div>
              <button type="button">Ver</button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
);

const ExecutiveAccount = () => (
  <section className="concept concept-b" aria-label="Alternativa B, Cuenta ejecutiva">
    <header className="b-header">
      <Brand compact />
      <nav className="b-nav">
        <a className="is-active" href="#resumen">Resumen</a>
        <a href="#servicios">Servicios</a>
        <a href="#documentos">Documentos <span>2</span></a>
        <a href="#facturas">Facturas</a>
      </nav>
      <div className="b-header__actions">
        <IconButton label="Buscar"><Search /></IconButton>
        <IconButton label="Notificaciones">
          <Bell />
          <i className="lab-notification-dot" />
        </IconButton>
        <button className="b-profile" type="button">
          <span>CM</span>
          <ChevronDown />
        </button>
      </div>
    </header>

    <div className="b-content">
      <div className="b-heading">
        <div>
          <span className="lab-eyebrow">CUENTA · ACME LOGÍSTICA SPA</span>
          <h1>Estado de cuenta</h1>
          <p>Información operacional y financiera al 23 de julio de 2026.</p>
        </div>
        <div className="b-heading__actions">
          <button className="lab-secondary-button" type="button">
            <FileText /> Descargar resumen
          </button>
          <button className="lab-primary-button" type="button">
            <Plus /> Nuevo servicio
          </button>
        </div>
      </div>

      <section className="b-balance-card">
        <div className="b-balance-card__intro">
          <span className="lab-eyebrow">POSICIÓN FINANCIERA</span>
          <strong>$1.925.000</strong>
          <p>Saldo total pendiente</p>
          <div className="b-balance-legend">
            <span><i className="is-current" /> $1.240.000 por vencer</span>
            <span><i className="is-overdue" /> $685.000 vencido</span>
          </div>
        </div>
        <div className="b-balance-chart">
          <div className="b-donut">
            <span><strong>64%</strong><small>al día</small></span>
          </div>
          <p>El 64% de tus documentos pendientes se encuentra dentro de plazo.</p>
        </div>
        <div className="b-balance-actions">
          <div>
            <FileWarning />
            <span><strong>2 O.C. faltantes</strong><small>Bloquean facturación</small></span>
          </div>
          <button type="button">Regularizar documentos <ArrowRight /></button>
        </div>
      </section>

      <div className="b-metric-strip">
        <article>
          <small>SERVICIOS DEL MES</small>
          <strong>27</strong>
          <span><i className="is-positive">↗ 12%</i> vs. mes anterior</span>
        </article>
        <article>
          <small>EN CURSO</small>
          <strong>1</strong>
          <span><i className="is-live" /> Llegada estimada 14:35</span>
        </article>
        <article>
          <small>COMPLETADOS</small>
          <strong>24</strong>
          <span><i className="is-positive">96%</i> dentro de plazo</span>
        </article>
        <article>
          <small>GASTO DEL MES</small>
          <strong>$7,8M</strong>
          <span><i className="is-neutral">→ 2%</i> vs. mes anterior</span>
        </article>
      </div>

      <div className="b-grid">
        <article className="b-table-card">
          <div className="lab-panel-heading">
            <div>
              <span className="lab-eyebrow">DOCUMENTOS</span>
              <h3>Últimas facturas</h3>
            </div>
            <button type="button">Ver historial <ArrowRight /></button>
          </div>
          <div className="b-table">
            <div className="b-table__head">
              <span>Documento</span><span>Vencimiento</span><span>Estado</span><span>Total</span>
            </div>
            {invoices.map((invoice) => (
              <div className="b-table__row" key={invoice.folio}>
                <span><FileText /><strong>{invoice.folio}</strong></span>
                <span>{invoice.date}</span>
                <Status tone={invoice.tone}>{invoice.status}</Status>
                <strong>{invoice.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="b-active-card">
          <div className="lab-panel-heading">
            <div>
              <span className="lab-eyebrow">EN CURSO</span>
              <h3>Servicio SRV-2841</h3>
            </div>
            <Status tone="live">En ruta</Status>
          </div>
          <div className="b-map">
            <span className="b-map__road road-one" />
            <span className="b-map__road road-two" />
            <span className="b-map__road road-three" />
            <span className="b-map__pin"><Truck /></span>
            <span className="b-map__destination"><MapPin /></span>
          </div>
          <div className="b-active-route">
            <span><i /> Quilicura</span>
            <ArrowRight />
            <span><i /> San Antonio</span>
          </div>
          <div className="b-active-meta">
            <span><Clock3 /><small>Llegada estimada</small><strong>14:35</strong></span>
            <span><Route /><small>Distancia restante</small><strong>42 km</strong></span>
          </div>
          <button className="lab-secondary-button" type="button">
            Abrir seguimiento <Navigation />
          </button>
        </article>
      </div>
    </div>
  </section>
);

const ServiceJourney = () => (
  <section className="concept concept-c" aria-label="Alternativa C, Ruta de servicio">
    <div className="c-shell">
      <header className="c-header">
        <Brand compact />
        <nav className="c-nav">
          <a className="is-active" href="#inicio"><LayoutDashboard /> Inicio</a>
          <a href="#servicios"><History /> Servicios</a>
          <a href="#documentos"><FileCheck2 /> Documentos <span>2</span></a>
          <a href="#facturas"><ReceiptText /> Facturas</a>
        </nav>
        <div className="c-header__actions">
          <IconButton label="Notificaciones">
            <Bell />
            <i className="lab-notification-dot" />
          </IconButton>
          <button className="c-user" type="button"><UserRound /><span>Camila</span><ChevronDown /></button>
        </div>
      </header>

      <main className="c-main">
        <section className="c-hero">
          <div className="c-hero__glow" />
          <div className="c-hero__copy">
            <span className="c-date-pill"><CalendarDays /> Jueves 23 de julio</span>
            <h1>Todo tu traslado,<br /><em>bajo control.</em></h1>
            <p>Revisa el avance de tus servicios, resuelve documentos y solicita un nuevo traslado desde un solo lugar.</p>
            <button className="c-hero-button" type="button">
              <Plus /> Solicitar un servicio <ArrowRight />
            </button>
          </div>
          <div className="c-hero__art">
            <div className="c-orbit orbit-one" />
            <div className="c-orbit orbit-two" />
            <div className="c-truck-card">
              <span><Truck /></span>
              <div><small>SERVICIO EN RUTA</small><strong>SRV-2841</strong></div>
              <Status tone="live">En vivo</Status>
            </div>
            <div className="c-arrival-card">
              <Clock3 />
              <div><small>Llegada estimada</small><strong>14:35</strong></div>
            </div>
            <div className="c-location-card">
              <MapPin />
              <div><small>Próximo destino</small><strong>Puerto de San Antonio</strong></div>
            </div>
          </div>
        </section>

        <section className="c-quick-grid">
          <article className="c-quick-card">
            <span className="c-quick-card__icon is-service"><Route /></span>
            <div><strong>27</strong><small>Servicios este mes</small></div>
            <button type="button"><ArrowRight /></button>
          </article>
          <article className="c-quick-card is-attention">
            <span className="c-quick-card__icon is-warning"><FileWarning /></span>
            <div><strong>2</strong><small>Documentos pendientes</small></div>
            <button type="button"><ArrowRight /></button>
          </article>
          <article className="c-quick-card">
            <span className="c-quick-card__icon is-invoice"><CircleDollarSign /></span>
            <div><strong>$1,9M</strong><small>Saldo por pagar</small></div>
            <button type="button"><ArrowRight /></button>
          </article>
        </section>

        <section className="c-content-grid">
          <article className="c-journey-card">
            <div className="lab-panel-heading">
              <div>
                <span className="lab-eyebrow">TU SERVICIO ACTIVO</span>
                <h3>Quilicura → San Antonio</h3>
              </div>
              <button type="button">Ver detalle <ArrowRight /></button>
            </div>
            <div className="c-timeline">
              <div className="c-step is-complete">
                <span><Check /></span>
                <div><strong>Servicio confirmado</strong><small>Hoy, 11:48</small></div>
              </div>
              <i />
              <div className="c-step is-complete">
                <span><Check /></span>
                <div><strong>Vehículo retirado</strong><small>Hoy, 12:34</small></div>
              </div>
              <i className="is-progress" />
              <div className="c-step is-current">
                <span><Truck /></span>
                <div><strong>En camino al destino</strong><small>42 km restantes</small></div>
              </div>
              <i />
              <div className="c-step">
                <span><PackageCheck /></span>
                <div><strong>Entrega en destino</strong><small>Estimada 14:35</small></div>
              </div>
            </div>
            <button className="c-track-button" type="button"><Navigation /> Seguir servicio en tiempo real</button>
          </article>

          <aside className="c-side-stack">
            <article className="c-alert-card">
              <div className="c-alert-card__icon"><Sparkles /></div>
              <div>
                <span className="lab-eyebrow">SIGUIENTE PASO</span>
                <h3>Completa tus órdenes de compra</h3>
                <p>Hay 2 servicios listos para facturar. Solo falta adjuntar la O.C.</p>
                <button type="button">Adjuntar documentos <ArrowRight /></button>
              </div>
              <button className="c-dismiss" type="button" aria-label="Cerrar"><X /></button>
            </article>
            <article className="c-trust-card">
              <ShieldCheck />
              <div><strong>Operación protegida</strong><small>Documentos y seguimiento seguros</small></div>
              <ChevronRight />
            </article>
          </aside>
        </section>
      </main>
    </div>
  </section>
);

const AlternativesLab = () => {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialDesign = query.get("design");
  const initialTheme = query.get("theme");
  const [design, setDesign] = useState<DesignId>(
    initialDesign === "executive" || initialDesign === "journey"
      ? initialDesign
      : "control",
  );
  const [theme, setTheme] = useState<PreviewTheme>(
    initialTheme === "dark" ? "dark" : "light",
  );

  const activeDesign = designs.find((item) => item.id === design) ?? designs[0];

  return (
    <div className={`portal-design-lab lab-theme-${theme}`}>
      <header className="lab-toolbar">
        <div className="lab-toolbar__title">
          <span>TMS</span>
          <div>
            <strong>Rediseño Portal de Clientes</strong>
            <small>Laboratorio visual · datos demostrativos</small>
          </div>
        </div>
        <div className="lab-design-switcher" role="tablist" aria-label="Alternativas de diseño">
          {designs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={design === item.id ? "is-active" : ""}
              onClick={() => setDesign(item.id)}
              role="tab"
              aria-selected={design === item.id}
            >
              <span>{item.letter}</span>
              <div><strong>{item.name}</strong><small>{item.summary}</small></div>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="lab-theme-toggle"
          onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
          aria-label={`Cambiar a tema ${theme === "light" ? "oscuro" : "claro"}`}
        >
          {theme === "light" ? <Moon /> : <Sun />}
          <span>{theme === "light" ? "Oscuro" : "Claro"}</span>
        </button>
      </header>

      <div className="lab-preview-meta">
        <span>Alternativa {activeDesign.letter}</span>
        <strong>{activeDesign.name}</strong>
        <small>{activeDesign.summary}</small>
      </div>

      <div className="lab-stage">
        {design === "control" && <ControlCenter />}
        {design === "executive" && <ExecutiveAccount />}
        {design === "journey" && <ServiceJourney />}
      </div>
    </div>
  );
};

createRoot(document.getElementById("portal-alternatives-root")!).render(
  <React.StrictMode>
    <AlternativesLab />
  </React.StrictMode>,
);
