import type { FC, ReactNode } from "react";
import { Card, EndorsableSkill } from "@/shared";
import type { SkillWithEndorsements } from "@/api/endorsementApi";
import { useI18n } from "@/shared/config";
import "./ProfileInfoCard.scss";

interface InfoField {
  /** Field label */
  label: string;
  /** Field value */
  value: string;
  /** Optional icon on the right */
  rightIcon?: ReactNode;
  /** On field click */
  onClick?: () => void;
}

interface ContactInfo {
  type: string;
  value: string;
  is_primary?: boolean;
}

interface TagInfo {
  id: string;
  name: string;
}

interface ProfileInfoCardProps {
  bio?: string;
  contacts?: ContactInfo[];
  tags?: TagInfo[];
  skillsWithEndorsements?: SkillWithEndorsements[];
  companyNames?: string[];
  phone?: string;
  username?: string;
  userHandle?: string | null;
  onUsernameClick?: () => void;
  onShareClick?: () => void;
  birthDate?: string;
  additionalFields?: InfoField[];
  className?: string;
}

export const ProfileInfoCard: FC<ProfileInfoCardProps> = ({
  bio,
  contacts = [],
  tags = [],
  skillsWithEndorsements = [],
  companyNames = [],
  phone,
  username,
  userHandle,
  onUsernameClick,
  onShareClick,
  className = "",
}) => {
  const { t } = useI18n();

  const phoneContact = contacts.find((c) => c.type === "phone");
  const displayPhone = phoneContact?.value || phone;

  const otherContacts = contacts.filter((c) => c.type !== "phone");

  const hasContent =
    bio ||
    username ||
    userHandle ||
    tags.length > 0 ||
    skillsWithEndorsements.length > 0 ||
    companyNames.length > 0 ||
    displayPhone ||
    otherContacts.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div className={`profile-info-cards ${className}`}>
      {/* Bio Card */}
      {bio && (
        <Card className="profile-info-cards__card">
          <span className="profile-info-cards__label">Bio</span>
          <p className="profile-info-cards__bio-text">{bio}</p>
        </Card>
      )}

      {/* Username Card */}
      {username && (
        <Card
          className="profile-info-cards__card"
          variant="interactive"
          onClick={onUsernameClick}
        >
          <div className="profile-info-cards__row">
            <div className="profile-info-cards__content">
              <span className="profile-info-cards__label">Username</span>
              <span className="profile-info-cards__value">@{username}</span>
            </div>
            <span className="profile-info-cards__qr-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect
                  x="2"
                  y="2"
                  width="6"
                  height="6"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="12"
                  y="2"
                  width="6"
                  height="6"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="2"
                  y="12"
                  width="6"
                  height="6"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect x="12" y="12" width="2" height="2" fill="currentColor" />
                <rect x="16" y="12" width="2" height="2" fill="currentColor" />
                <rect x="12" y="16" width="2" height="2" fill="currentColor" />
                <rect x="16" y="16" width="2" height="2" fill="currentColor" />
                <rect x="14" y="14" width="2" height="2" fill="currentColor" />
              </svg>
            </span>
          </div>
        </Card>
      )}

      {/* User ID Card */}
      {userHandle && (
        <Card
          className="profile-info-cards__card"
          variant="interactive"
          onClick={onShareClick}
        >
          <div className="profile-info-cards__row">
            <div className="profile-info-cards__content">
              <span className="profile-info-cards__label">
                {t("profile.userId")}
              </span>
              <span className="profile-info-cards__value profile-info-cards__value--accent">
                @{userHandle}
              </span>
            </div>
            <span className="profile-info-cards__share-icon">
              <svg width="20" height="20" viewBox="0 0 120 120" fill="none">
                <path
                  d="M13.8104 54.9865C9.18531 54.9865 5.71654 53.8302 3.40402 51.5177C1.13433 49.2052 -0.000521637 45.6508 -0.000521637 40.8544V14.0678C-0.000521637 9.27143 1.13433 5.73842 3.40402 3.46872C5.71654 1.15621 9.18531 -5.26756e-05 13.8104 -5.26756e-05H41.1109C45.736 -5.26756e-05 49.2047 1.15621 51.5172 3.46872C53.8298 5.73842 54.986 9.27143 54.986 14.0678V40.8544C54.986 45.6508 53.8298 49.2052 51.5172 51.5177C49.2047 53.8302 45.736 54.9865 41.1109 54.9865H13.8104ZM13.6176 44.7729H41.3036C42.4599 44.7729 43.3378 44.4731 43.9373 43.8736C44.5369 43.274 44.8366 42.3747 44.8366 41.1756V13.6823C44.8366 12.4833 44.5369 11.6054 43.9373 11.0486C43.3378 10.4491 42.4599 10.1493 41.3036 10.1493H13.6176C12.4614 10.1493 11.5835 10.4491 10.9839 11.0486C10.4272 11.6054 10.1489 12.4833 10.1489 13.6823V41.1756C10.1489 42.3747 10.4272 43.274 10.9839 43.8736C11.5835 44.4731 12.4614 44.7729 13.6176 44.7729ZM21.7115 34.5592C20.8121 34.5592 20.3625 34.0239 20.3625 32.9533V21.8404C20.3625 20.8554 20.8121 20.363 21.7115 20.363H33.1456C34.0877 20.363 34.5588 20.8554 34.5588 21.8404V32.9533C34.5588 34.0239 34.0877 34.5592 33.1456 34.5592H21.7115ZM78.8178 54.9865C74.1928 54.9865 70.724 53.8302 68.4115 51.5177C66.099 49.2052 64.9427 45.6508 64.9427 40.8544V14.0678C64.9427 9.27143 66.099 5.73842 68.4115 3.46872C70.724 1.15621 74.1928 -5.26756e-05 78.8178 -5.26756e-05H106.118C110.743 -5.26756e-05 114.191 1.15621 116.46 3.46872C118.773 5.73842 119.929 9.27143 119.929 14.0678V40.8544C119.929 45.6508 118.773 49.2052 116.46 51.5177C114.191 53.8302 110.743 54.9865 106.118 54.9865H78.8178ZM78.6251 44.7729H106.311C107.51 44.7729 108.388 44.4731 108.945 43.8736C109.502 43.274 109.78 42.3747 109.78 41.1756V13.6823C109.78 12.4833 109.502 11.6054 108.945 11.0486C108.388 10.4491 107.51 10.1493 106.311 10.1493H78.6251C77.426 10.1493 76.5267 10.4491 75.9272 11.0486C75.3704 11.6054 75.0921 12.4833 75.0921 13.6823V41.1756C75.0921 42.3747 75.3704 43.274 75.9272 43.8736C76.5267 44.4731 77.426 44.7729 78.6251 44.7729ZM86.9759 34.5592C86.1622 34.5592 85.7554 34.0239 85.7554 32.9533V21.8404C85.7554 20.8554 86.1622 20.363 86.9759 20.363H98.4742C99.4164 20.363 99.8874 20.8554 99.8874 21.8404V32.9533C99.8874 34.0239 99.4164 34.5592 98.4742 34.5592H86.9759ZM13.8104 119.93C9.18531 119.93 5.71654 118.773 3.40402 116.461C1.13433 114.191 -0.000521637 110.658 -0.000521637 105.862V79.011C-0.000521637 74.2575 1.13433 70.7245 3.40402 68.4119C5.71654 66.0994 9.18531 64.9432 13.8104 64.9432H41.1109C45.736 64.9432 49.2047 66.0994 51.5172 68.4119C53.8298 70.7245 54.986 74.2575 54.986 79.011V105.862C54.986 110.658 53.8298 114.191 51.5172 116.461C49.2047 118.773 45.736 119.93 41.1109 119.93H13.8104ZM13.6176 109.78H41.3036C42.4599 109.78 43.3378 109.481 43.9373 108.881C44.5369 108.281 44.8366 107.404 44.8366 106.247V78.6898C44.8366 77.4907 44.5369 76.5914 43.9373 75.9919C43.3378 75.3923 42.4599 75.0926 41.3036 75.0926H13.6176C12.4614 75.0926 11.5835 75.3923 10.9839 75.9919C10.4272 76.5914 10.1489 77.4907 10.1489 78.6898V106.247C10.1489 107.404 10.4272 108.281 10.9839 108.881C11.5835 109.481 12.4614 109.78 13.6176 109.78ZM21.7115 99.5667C20.8121 99.5667 20.3625 99.0314 20.3625 97.9608V86.8479C20.3625 85.8629 20.8121 85.3704 21.7115 85.3704H33.1456C34.0877 85.3704 34.5588 85.8629 34.5588 86.8479V97.9608C34.5588 99.0314 34.0877 99.5667 33.1456 99.5667H21.7115ZM69.5035 82.0943C68.6042 82.0943 68.1545 81.5805 68.1545 80.5527V69.4397C68.1545 68.4548 68.6042 67.9623 69.5035 67.9623H80.9376C81.8369 67.9623 82.2866 68.4548 82.2866 69.4397V80.5527C82.2866 81.5805 81.8369 82.0943 80.9376 82.0943H69.5035ZM103.87 82.0943C102.971 82.0943 102.521 81.5805 102.521 80.5527V69.4397C102.521 68.4548 102.971 67.9623 103.87 67.9623H115.304C116.204 67.9623 116.653 68.4548 116.653 69.4397V80.5527C116.653 81.5805 116.204 82.0943 115.304 82.0943H103.87ZM86.8474 99.374C85.9481 99.374 85.4984 98.8387 85.4984 97.7681V86.6551C85.4984 85.6702 85.9481 85.1777 86.8474 85.1777H98.2815C99.1808 85.1777 99.6305 85.6702 99.6305 86.6551V97.7681C99.6305 98.8387 99.1808 99.374 98.2815 99.374H86.8474ZM69.5035 116.525C68.6042 116.525 68.1545 116.011 68.1545 114.983V103.806C68.1545 102.821 68.6042 102.329 69.5035 102.329H80.9376C81.8369 102.329 82.2866 102.821 82.2866 103.806V114.983C82.2866 116.011 81.8369 116.525 80.9376 116.525H69.5035ZM103.87 116.525C102.971 116.525 102.521 116.011 102.521 114.983V103.806C102.521 102.821 102.971 102.329 103.87 102.329H115.304C116.204 102.329 116.653 102.821 116.653 103.806V114.983C116.653 116.011 116.204 116.525 115.304 116.525H103.87Z"
                    fill="#0081ff"
                    fill-opacity="1"
                />
              </svg>
            </span>
          </div>
        </Card>
      )}

      {/* Phone Card */}
      {displayPhone && (
        <Card className="profile-info-cards__card">
          <span className="profile-info-cards__label">Phone</span>
          <a
            href={`tel:${displayPhone}`}
            className="profile-info-cards__value profile-info-cards__value--link"
          >
            {displayPhone}
          </a>
        </Card>
      )}

      {/* Other contacts cards */}
      {otherContacts.map((contact, index) => (
        <Card
          key={`${contact.type}-${index}`}
          className="profile-info-cards__card"
        >
          <span className="profile-info-cards__label">
            {contact.type.charAt(0).toUpperCase() + contact.type.slice(1)}
          </span>
          {contact.type === "email" ? (
            <a
              href={`mailto:${contact.value}`}
              className="profile-info-cards__value profile-info-cards__value--link"
            >
              {contact.value}
            </a>
          ) : contact.type === "telegram" ? (
            <a
              href={`https://t.me/${contact.value.replace("@", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-info-cards__value profile-info-cards__value--link"
            >
              {contact.value.startsWith("@")
                ? contact.value
                : `@${contact.value}`}
            </a>
          ) : contact.type === "website" ? (
            <a
              href={
                contact.value.startsWith("http")
                  ? contact.value
                  : `https://${contact.value}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="profile-info-cards__value profile-info-cards__value--link"
            >
              {contact.value}
            </a>
          ) : (
            <span className="profile-info-cards__value">{contact.value}</span>
          )}
        </Card>
      ))}

      {/* Skills Card with Endorsements */}
      {skillsWithEndorsements.length > 0 ? (
        <Card className="profile-info-cards__card">
          <span className="profile-info-cards__label">
            {t("profile.skillsLabel")}
          </span>
          <div className="profile-info-cards__tags">
            {companyNames.map((name) => (
              <span
                key={`company-${name}`}
                className="profile-info-cards__tag profile-info-cards__tag--company"
              >
                <span className="profile-info-cards__tag-icon">🏢</span>
                {name}
              </span>
            ))}
            {skillsWithEndorsements.map((skill) => (
              <EndorsableSkill
                key={skill.tag_id}
                skill={skill}
                canEndorse={false}
              />
            ))}
          </div>
        </Card>
      ) : tags.length > 0 || companyNames.length > 0 ? (
        <Card className="profile-info-cards__card">
          <span className="profile-info-cards__label">
            {t("profile.skillsLabel")}
          </span>
          <div className="profile-info-cards__tags">
            {companyNames.map((name) => (
              <span
                key={`company-${name}`}
                className="profile-info-cards__tag profile-info-cards__tag--company"
              >
                <span className="profile-info-cards__tag-icon">🏢</span>
                {name}
              </span>
            ))}
            {tags.map((tag) => (
              <span key={tag.id} className="profile-info-cards__tag">
                <span className="profile-info-cards__tag-icon">
                  <svg
                    width="12"
                    height="11"
                    viewBox="0 0 12 11"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M0 3.65625C0 3.11719 0.0859375 2.625 0.257812 2.17969C0.429688 1.73047 0.669922 1.34375 0.978516 1.01953C1.29102 0.695313 1.6543 0.445312 2.06836 0.269531C2.48242 0.0898437 2.92773 0 3.4043 0C3.96289 0 4.45703 0.119141 4.88672 0.357422C5.31641 0.591797 5.66016 0.902344 5.91797 1.28906C6.18359 0.902344 6.5293 0.591797 6.95508 0.357422C7.38477 0.119141 7.87891 0 8.4375 0C8.91797 0 9.36328 0.0898437 9.77344 0.269531C10.1875 0.445312 10.5488 0.695313 10.8574 1.01953C11.166 1.34375 11.4062 1.73047 11.5781 2.17969C11.7539 2.625 11.8418 3.11719 11.8418 3.65625C11.8418 4.48828 11.6211 5.31445 11.1797 6.13477C10.7383 6.95508 10.1152 7.75195 9.31055 8.52539C8.50977 9.29883 7.5625 10.0371 6.46875 10.7402C6.37891 10.7988 6.2832 10.8516 6.18164 10.8984C6.08398 10.9453 5.99609 10.9688 5.91797 10.9688C5.84766 10.9688 5.76172 10.9453 5.66016 10.8984C5.55859 10.8516 5.46484 10.7988 5.37891 10.7402C4.28516 10.0371 3.33398 9.29883 2.52539 8.52539C1.7207 7.75195 1.09766 6.95508 0.65625 6.13477C0.21875 5.31445 0 4.48828 0 3.65625ZM1.18359 3.65039C1.18359 4.16602 1.30664 4.69141 1.55273 5.22656C1.80273 5.76172 2.14258 6.29102 2.57227 6.81445C3.00195 7.33789 3.49414 7.83984 4.04883 8.32031C4.60742 8.79688 5.19531 9.24023 5.8125 9.65039C5.86719 9.69336 5.90234 9.71484 5.91797 9.71484C5.93359 9.71484 5.97266 9.69336 6.03516 9.65039C6.65234 9.24023 7.23828 8.79688 7.79297 8.32031C8.34766 7.83984 8.83984 7.33789 9.26953 6.81445C9.69922 6.29102 10.0371 5.76172 10.2832 5.22656C10.5332 4.69141 10.6582 4.16602 10.6582 3.65039C10.6582 3.1543 10.5586 2.7207 10.3594 2.34961C10.1602 1.97852 9.88672 1.68945 9.53906 1.48242C9.19531 1.27148 8.80664 1.16602 8.37305 1.16602C8.01758 1.16602 7.71289 1.22852 7.45898 1.35352C7.20898 1.47461 6.99414 1.62891 6.81445 1.81641C6.63477 2 6.47852 2.18359 6.3457 2.36719C6.25977 2.48047 6.18555 2.56055 6.12305 2.60742C6.06445 2.6543 5.99609 2.67773 5.91797 2.67773C5.84375 2.67773 5.77539 2.65625 5.71289 2.61328C5.65039 2.56641 5.57617 2.48438 5.49023 2.36719C5.36914 2.17969 5.21875 1.99414 5.03906 1.81055C4.85938 1.62695 4.64062 1.47461 4.38281 1.35352C4.125 1.22852 3.82031 1.16602 3.46875 1.16602C3.03516 1.16602 2.64453 1.27148 2.29688 1.48242C1.95312 1.68945 1.68164 1.97852 1.48242 2.34961C1.2832 2.7207 1.18359 3.1543 1.18359 3.65039Z"
                      fill="#CD2B2B"
                    />
                  </svg>
                </span>
                {tag.name}
              </span>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
};
