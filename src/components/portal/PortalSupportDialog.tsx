import React from "react";
import {
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PortalSupportDialogProps {
  companyName: string;
  clientEmail?: string;
  email: string;
  onAction?: () => void;
  phone?: string;
}

const normalizePhone = (value?: string) => {
  if (!value) return null;

  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 9) digits = `56${digits}`;

  return digits.length >= 10 ? digits : null;
};

const PortalSupportDialog: React.FC<PortalSupportDialogProps> = ({
  companyName,
  clientEmail,
  email,
  onAction,
  phone,
}) => {
  const normalizedPhone = normalizePhone(phone);
  const subject = encodeURIComponent(
    `Solicitud de soporte — Portal Clientes — ${companyName}`,
  );
  const message = [
    "Hola, necesito ayuda con el Portal Clientes.",
    "",
    `Empresa: ${companyName}`,
    `Usuario: ${clientEmail || "Sin información"}`,
    "",
    "Detalle de la solicitud:",
  ].join("\n");
  const encodedMessage = encodeURIComponent(message);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="portal-client-support"
          aria-label="Abrir soporte operacional"
        >
          <CircleHelp />
          <span>
            <small>¿Necesitas ayuda?</small>
            <strong>Soporte operacional</strong>
          </span>
          <ChevronRight />
        </button>
      </DialogTrigger>

      <DialogContent className="portal-support-dialog">
        <DialogHeader className="portal-support-dialog__header">
          <span className="portal-support-dialog__eyebrow">
            <Headphones />
            Atención operacional
          </span>
          <DialogTitle>¿Cómo podemos ayudarte?</DialogTitle>
          <DialogDescription>
            Elige el canal que prefieras. Incluiremos tus datos de cliente para
            agilizar la atención.
          </DialogDescription>
        </DialogHeader>

        <div className="portal-support-dialog__channels">
          {normalizedPhone && (
            <a
              href={`tel:+${normalizedPhone}`}
              className="portal-support-channel"
              onClick={onAction}
            >
              <span className="portal-support-channel__icon">
                <Phone />
              </span>
              <span>
                <small>Atención telefónica</small>
                <strong>Llamar a soporte</strong>
                <em>{phone}</em>
              </span>
              <ArrowUpRight />
            </a>
          )}

          {normalizedPhone && (
            <a
              href={`https://wa.me/${normalizedPhone}?text=${encodedMessage}`}
              target="_blank"
              rel="noreferrer"
              className="portal-support-channel"
              onClick={onAction}
            >
              <span className="portal-support-channel__icon">
                <MessageCircle />
              </span>
              <span>
                <small>Respuesta por mensajería</small>
                <strong>Escribir por WhatsApp</strong>
                <em>Se abrirá una conversación nueva</em>
              </span>
              <ArrowUpRight />
            </a>
          )}

          <a
            href={`mailto:${email}?subject=${subject}&body=${encodedMessage}`}
            className="portal-support-channel"
            onClick={onAction}
          >
            <span className="portal-support-channel__icon">
              <Mail />
            </span>
            <span>
              <small>Solicitud detallada</small>
              <strong>Enviar un correo</strong>
              <em>{email}</em>
            </span>
            <ArrowUpRight />
          </a>
        </div>

        <p className="portal-support-dialog__note">
          Para incidencias de un servicio, incluye el folio o la patente en tu
          mensaje.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default PortalSupportDialog;
