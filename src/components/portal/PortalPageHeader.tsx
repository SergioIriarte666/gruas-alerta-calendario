import type { LucideIcon } from "lucide-react";

interface PortalPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export const PortalPageHeader = ({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: PortalPageHeaderProps) => (
  <header className="portal-page-header">
    <div className="portal-page-header__copy">
      <div className="portal-page-header__eyebrow">
        {Icon && <Icon />}
        <span>{eyebrow}</span>
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {actions && <div className="portal-page-header__actions">{actions}</div>}
  </header>
);
