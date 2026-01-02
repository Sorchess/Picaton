import type { CompanyWithRole } from "@/entities/company";
import { roleLabels } from "@/entities/company";
import { Typography, Tag, Button } from "@/shared";
import "./CompanyList.scss";

interface CompanyListProps {
  companies: CompanyWithRole[];
  onSelectCompany: (company: CompanyWithRole) => void;
  onCreateCompany: () => void;
}

export function CompanyList({
  companies,
  onSelectCompany,
  onCreateCompany,
}: CompanyListProps) {
  if (companies.length === 0) {
    return (
      <div className="company-list-empty">
        <div className="company-list-empty__icon">🏢</div>
        <Typography variant="h2" className="company-list-empty__title">
          Здесь пока нет компаний
        </Typography>
        <Typography
          variant="body"
          color="secondary"
          className="company-list-empty__description"
        >
          Создайте свою первую компанию или дождитесь приглашения от коллег
        </Typography>
        <Button
          onClick={onCreateCompany}
          className="company-list-empty__button"
        >
          <span className="company-list-empty__button-icon">+</span>
          Создать компанию
        </Button>
      </div>
    );
  }

  return (
    <div className="company-list">
      <div className="company-list__header">
        <Typography variant="h1">Мои компании</Typography>
        <Button onClick={onCreateCompany} size="sm">
          + Создать
        </Button>
      </div>

      <div className="company-list__grid">
        {companies.map((item) => (
          <div
            key={item.company.id}
            className="company-card"
            onClick={() => onSelectCompany(item)}
          >
            <div className="company-card__logo">
              {item.company.logo_url ? (
                <img src={item.company.logo_url} alt={item.company.name} />
              ) : (
                <span className="company-card__logo-letter">
                  {item.company.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="company-card__content">
              <Typography variant="h3" className="company-card__name">
                {item.company.name}
              </Typography>
              <Typography
                variant="small"
                color="secondary"
                className="company-card__domain"
              >
                @{item.company.email_domain}
              </Typography>
              {item.company.description && (
                <Typography
                  variant="small"
                  color="secondary"
                  className="company-card__description"
                >
                  {item.company.description}
                </Typography>
              )}
            </div>
            <div className="company-card__footer">
              <Tag
                size="sm"
                variant={item.role === "owner" ? "outline" : "default"}
              >
                {roleLabels[item.role]}
              </Tag>
              <span className="company-card__arrow">→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
