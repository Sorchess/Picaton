import type { CompanyWithRole } from "@/entities/company";
import { getRoleName } from "@/entities/company";
import { Typography, Button } from "@/shared";
import { useI18n } from "@/shared/config";
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
  const { t } = useI18n();

  if (companies.length === 0) {
    return (
      <div className="company-list-empty">
        <div className="company-list-empty__icon">🏢</div>
        <Typography variant="h2" className="company-list-empty__title">
          {t("company.noCompaniesEmpty")}
        </Typography>
        <Typography
          variant="body"
          color="secondary"
          className="company-list-empty__description"
        >
          {t("company.noCompaniesHint")}
        </Typography>
        <Button
          onClick={onCreateCompany}
          className="company-list-empty__button"
        >
          <span className="company-list-empty__button-icon">+</span>
          {t("company.createCompanyBtn")}
        </Button>
      </div>
    );
  }

  return (
    <div className="company-list">
      <div className="company-list__items">
        {companies.map((item) => (
          <button
            key={item.company.id}
            className="company-card"
            onClick={() => onSelectCompany(item)}
            type="button"
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
              <span className="company-card__name">{item.company.name}</span>
              <span className="company-card__role">
                {getRoleName(item.role)}
              </span>
            </div>

            <svg
              className="company-card__chevron"
              width="8"
              height="14"
              viewBox="0 0 8 14"
              fill="none"
            >
              <path
                d="M1 1L7 7L1 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
