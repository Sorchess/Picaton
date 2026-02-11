import { useState, useEffect } from "react";
import { ThemeProvider, ThemeToggle } from "./shared";
import { PageSwitcher } from "./widgets";
import type { PageType } from "./widgets";
import {
  ContactsPage,
  ProfilePage,
  LoginPage,
  OnboardingPage,
  CompanyPage,
  CollaborationPage,
  ContactProfilePage,
  ShareContactPage,
  ChatsPage,
} from "./pages";
import { AuthProvider, useAuth } from "./features/auth";
import { EmailModal } from "./features/email-modal";
import { companyApi } from "./entities/company";
import type { UserPublic, SavedContact } from "./entities/user";
import { userApi } from "./entities/user";
import { businessCardApi } from "./entities/business-card";
import "./App.scss";

// Парсинг URL для получения токена приглашения
function getInviteTokenFromUrl(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/invite\/([^/]+)$/);
  return match ? match[1] : null;
}

// Парсинг URL для получения ID пользователя из QR кода
function getUserIdFromUrl(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/users\/([^/]+)$/);
  return match ? match[1] : null;
}

// Парсинг URL для получения ID карточки из QR кода
function getCardIdFromUrl(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/cards\/([^/]+)$/);
  return match ? match[1] : null;
}

// Сохранение токена для использования после авторизации
function saveInviteToken(token: string) {
  sessionStorage.setItem("pendingInviteToken", token);
}

function getPendingInviteToken(): string | null {
  return sessionStorage.getItem("pendingInviteToken");
}

function clearPendingInviteToken() {
  sessionStorage.removeItem("pendingInviteToken");
}

// Расширенный тип страницы для поддержки профиля контакта и страницы поделиться
type ExtendedPageType = PageType | "contact-profile" | "share-contact";

// Контекст для навигации на профиль контакта
interface ContactProfileNavData {
  user: UserPublic;
  cardId?: string;
  cardIds?: string[]; // Массив ID карточек для предпросмотра нескольких
  savedContact?: SavedContact | null;
  returnPage: PageType;
  singleCardMode?: boolean;
}

// Контекст для навигации на страницу поделиться контактом
interface ShareContactNavData {
  cards: import("./entities/business-card").BusinessCard[];
  returnPage: PageType;
}

function AuthenticatedApp() {
  const { user, logout, refreshUser } = useAuth();
  const [currentPage, setCurrentPage] = useState<ExtendedPageType>("contacts");
  const [previousPage, setPreviousPage] = useState<PageType>("contacts");
  const [inviteProcessing, setInviteProcessing] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Данные для страницы профиля контакта
  const [contactProfileData, setContactProfileData] =
    useState<ContactProfileNavData | null>(null);

  // Данные для страницы поделиться контактом
  const [shareContactData, setShareContactData] =
    useState<ShareContactNavData | null>(null);

  // ID карточки для открытия на странице профиля
  const [profileOpenCardId, setProfileOpenCardId] = useState<
    string | undefined
  >(undefined);

  // Search query from the tab-bar search button
  const [tabBarSearchQuery, setTabBarSearchQuery] = useState<
    string | undefined
  >(undefined);

  // Данные для открытия чата с конкретным пользователем
  const [chatTargetUser, setChatTargetUser] = useState<UserPublic | null>(null);

  // Чат открыт (для скрытия мобильного футера)
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Функция навигации на страницу профиля контакта
  const navigateToContactProfile = (data: ContactProfileNavData) => {
    setContactProfileData(data);
    setPreviousPage(currentPage as PageType);
    setCurrentPage("contact-profile");
  };

  // Функция возврата со страницы профиля
  const navigateBackFromContactProfile = () => {
    // Если есть сохранённые данные share-contact, возвращаемся туда
    if (shareContactData) {
      setCurrentPage("share-contact");
    } else {
      setCurrentPage(contactProfileData?.returnPage || previousPage);
    }
    setContactProfileData(null);
  };

  // Функция навигации на страницу поделиться контактом
  const navigateToShareContact = (data: ShareContactNavData) => {
    setShareContactData(data);
    setPreviousPage(currentPage as PageType);
    setCurrentPage("share-contact");
  };

  // Функция возврата со страницы поделиться контактом
  const navigateBackFromShareContact = () => {
    setCurrentPage(shareContactData?.returnPage || previousPage);
    setShareContactData(null);
  };

  // Функция перехода к визитке из страницы поделиться
  const navigateToCardFromShareContact = (cardId: string) => {
    setProfileOpenCardId(cardId);
    setCurrentPage("profile");
    setShareContactData(null);
  };

  // Функция предпросмотра визитки из страницы поделиться (открывает страницу профиля как её увидит другой пользователь)
  const navigateToPreviewFromShareContact = async (cardIds: string[]) => {
    if (cardIds.length === 0) return;

    try {
      // Загружаем публичные данные первой карточки для базовых данных пользователя
      const cardData = await businessCardApi.getPublic(cardIds[0]);

      // Преобразуем данные карточки в формат UserPublic
      const firstName = cardData.display_name
        ? cardData.display_name.split(" ")[0]
        : "";
      const lastName = cardData.display_name
        ? cardData.display_name.split(" ").slice(1).join(" ")
        : "";

      const userData: UserPublic & { card_id?: string } = {
        id: cardData.owner_id,
        card_id: cardData.id,
        first_name: firstName,
        last_name: lastName,
        avatar_url: cardData.avatar_url,
        bio: cardData.bio,
        ai_generated_bio: cardData.ai_generated_bio,
        location: null,
        tags: cardData.tags,
        search_tags: cardData.search_tags,
        contacts: cardData.contacts.map((c) => ({
          type: c.type,
          value: c.value,
          is_primary: c.is_primary,
          is_visible: c.is_visible,
        })),
        profile_completeness: cardData.completeness,
      };

      // НЕ очищаем shareContactData, чтобы можно было вернуться обратно
      // Если выбрана только одна карточка - singleCardMode, иначе показываем табы
      setContactProfileData({
        user: userData,
        cardId: cardIds[0],
        cardIds: cardIds,
        savedContact: null,
        returnPage: previousPage,
        singleCardMode: cardIds.length === 1,
      });
      setCurrentPage("contact-profile");
    } catch (error) {
      console.error("Failed to load card for preview:", error);
    }
  };

  // Функция смены страницы через PageSwitcher
  const handlePageChange = (page: PageType) => {
    setCurrentPage(page);
    setContactProfileData(null);
    setShareContactData(null);
    setProfileOpenCardId(undefined);
    setTabBarSearchQuery(undefined);
    setChatTargetUser(null);
  };

  // Навигация в чат с пользователем
  const navigateToChat = (targetUser: UserPublic) => {
    setChatTargetUser(targetUser);
    setCurrentPage("chats");
  };

  // Handle search submitted from the tab-bar search button
  const handleTabBarSearch = (query: string) => {
    setTabBarSearchQuery(query);
    setCurrentPage("contacts");
  };

  // QR code loading state
  const [isLoadingQrUser, setIsLoadingQrUser] = useState(false);
  const [qrUserLoaded, setQrUserLoaded] = useState(false);

  // Email modal state for Telegram users with placeholder email
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalShown, setEmailModalShown] = useState(false);

  // Проверяем placeholder email при входе через Telegram
  const isPlaceholderEmail = user?.email?.includes("@telegram.placeholder");

  // Открываем модалку для ввода email, если email - placeholder (только один раз за сессию)
  useEffect(() => {
    if (isPlaceholderEmail && !emailModalShown) {
      // Небольшая задержка для UX
      const timer = setTimeout(() => {
        setIsEmailModalOpen(true);
        setEmailModalShown(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPlaceholderEmail, emailModalShown]);

  // Обработка приглашения из URL или сохраненного токена
  useEffect(() => {
    const urlToken = getInviteTokenFromUrl();
    const pendingToken = getPendingInviteToken();
    const token = urlToken || pendingToken;

    if (!token || inviteProcessing) return;

    // Используем флаг для предотвращения повторных вызовов
    let cancelled = false;

    const processInvite = async () => {
      setInviteProcessing(true);
      // Очищаем сохраненный токен
      clearPendingInviteToken();

      try {
        await companyApi.acceptInvitation({ token });
        if (!cancelled) {
          setInviteMessage({
            type: "success",
            text: "Вы успешно присоединились к компании!",
          });
          setCurrentPage("company");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const error = err as { data?: { detail?: string }; message?: string };
          const errorMessage =
            error?.data?.detail ||
            error?.message ||
            "Не удалось принять приглашение";
          setInviteMessage({ type: "error", text: errorMessage });
        }
      } finally {
        if (!cancelled) {
          setInviteProcessing(false);
        }
        // Очищаем URL
        window.history.replaceState({}, "", "/");
      }
    };

    processInvite();

    return () => {
      cancelled = true;
    };
  }, [inviteProcessing]);

  // Обработка ссылки на пользователя из QR кода
  useEffect(() => {
    const userId = getUserIdFromUrl();
    if (!userId || isLoadingQrUser || qrUserLoaded) return;

    let cancelled = false;

    const loadUser = async () => {
      setIsLoadingQrUser(true);
      try {
        const userData = await userApi.getPublic(userId);
        if (!cancelled) {
          // Навигируем на страницу профиля вместо открытия модального окна
          navigateToContactProfile({
            user: userData,
            cardId: undefined,
            savedContact: null,
            returnPage: "contacts",
          });
          setQrUserLoaded(true);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const error = err as { data?: { detail?: string }; message?: string };
          const errorMessage =
            error?.data?.detail ||
            error?.message ||
            "Не удалось загрузить профиль пользователя";
          setInviteMessage({ type: "error", text: errorMessage });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQrUser(false);
        }
        // Очищаем URL
        window.history.replaceState({}, "", "/");
      }
    };

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [isLoadingQrUser, qrUserLoaded, navigateToContactProfile]);

  // Обработка ссылки на карточку из QR кода
  useEffect(() => {
    const cardId = getCardIdFromUrl();
    if (!cardId || isLoadingQrUser || qrUserLoaded) return;

    let cancelled = false;

    const loadCard = async () => {
      setIsLoadingQrUser(true);
      try {
        const cardData = await businessCardApi.getPublic(cardId);
        if (!cancelled) {
          // Преобразуем данные карточки в формат UserPublic
          const firstName = cardData.display_name
            ? cardData.display_name.split(" ")[0]
            : "";
          const lastName = cardData.display_name
            ? cardData.display_name.split(" ").slice(1).join(" ")
            : "";

          const userData: UserPublic & { card_id?: string } = {
            id: cardData.owner_id,
            card_id: cardData.id,
            first_name: firstName,
            last_name: lastName,
            avatar_url: cardData.avatar_url,
            bio: cardData.bio,
            ai_generated_bio: cardData.ai_generated_bio,
            location: null,
            tags: cardData.tags,
            search_tags: cardData.search_tags,
            contacts: cardData.contacts.map((c) => ({
              type: c.type,
              value: c.value,
              is_primary: c.is_primary,
              is_visible: c.is_visible,
            })),
            profile_completeness: cardData.completeness,
          };

          // Навигируем на страницу профиля вместо открытия модального окна
          navigateToContactProfile({
            user: userData,
            cardId: cardData.id,
            savedContact: null,
            returnPage: "contacts",
          });
          setQrUserLoaded(true);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const error = err as { data?: { detail?: string }; message?: string };
          const errorMessage =
            error?.data?.detail ||
            error?.message ||
            "Не удалось загрузить визитку";
          setInviteMessage({ type: "error", text: errorMessage });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQrUser(false);
        }
        // Очищаем URL
        window.history.replaceState({}, "", "/");
      }
    };

    loadCard();

    return () => {
      cancelled = true;
    };
  }, [isLoadingQrUser, qrUserLoaded, navigateToContactProfile]);

  // Автоскрытие сообщения
  useEffect(() => {
    if (inviteMessage) {
      const timer = setTimeout(() => setInviteMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [inviteMessage]);

  // Показываем загрузку при обработке приглашения
  if (inviteProcessing) {
    return (
      <div className="app app--loading">
        <div className="app__loader">
          <div className="app__spinner" />
          <span>Принимаем приглашение...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Уведомление о приглашении */}
      {inviteMessage && (
        <div
          className={`app__invite-notification app__invite-notification--${inviteMessage.type}`}
        >
          <span>{inviteMessage.text}</span>
          <button onClick={() => setInviteMessage(null)}>×</button>
        </div>
      )}

      <header className="app__header">
        <div className="app__logo">
          <svg
            width="41"
            height="43"
            viewBox="0 0 41 43"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g filter="url(#filter0_ddii_1045_23546)">
              <path
                d="M15.6699 7.40995C15.6699 2.43033 22.1549 0.511287 24.8647 4.689L27.0697 8.08838C27.4651 8.69792 27.9886 9.21396 28.6037 9.60061L36.6791 14.6766C40.172 16.8721 39.653 22.1144 35.7975 23.5825L25.9007 27.351C24.5676 27.8586 23.5149 28.9114 23.0073 30.2444L20.3426 37.2423C18.7074 41.5366 12.6324 41.5366 10.9972 37.2423L8.15462 29.7771C7.76023 28.7413 6.94226 27.9234 5.90653 27.529C1.87508 25.9939 2.97512 20.0137 7.28896 20.0137H11.0866C13.6179 20.0137 15.6699 17.9616 15.6699 15.4303V7.40995Z"
                fill="#0081FF"
              />
              <path
                d="M15.6699 7.40995C15.6699 2.43033 22.1549 0.511287 24.8647 4.689L27.0697 8.08838C27.4651 8.69792 27.9886 9.21396 28.6037 9.60061L36.6791 14.6766C40.172 16.8721 39.653 22.1144 35.7975 23.5825L25.9007 27.351C24.5676 27.8586 23.5149 28.9114 23.0073 30.2444L20.3426 37.2423C18.7074 41.5366 12.6324 41.5366 10.9972 37.2423L8.15462 29.7771C7.76023 28.7413 6.94226 27.9234 5.90653 27.529C1.87508 25.9939 2.97512 20.0137 7.28896 20.0137H11.0866C13.6179 20.0137 15.6699 17.9616 15.6699 15.4303V7.40995Z"
                fill="url(#paint0_radial_1045_23546)"
              />
              <path
                d="M15.6699 7.40995C15.6699 2.43033 22.1549 0.511287 24.8647 4.689L27.0697 8.08838C27.4651 8.69792 27.9886 9.21396 28.6037 9.60061L36.6791 14.6766C40.172 16.8721 39.653 22.1144 35.7975 23.5825L25.9007 27.351C24.5676 27.8586 23.5149 28.9114 23.0073 30.2444L20.3426 37.2423C18.7074 41.5366 12.6324 41.5366 10.9972 37.2423L8.15462 29.7771C7.76023 28.7413 6.94226 27.9234 5.90653 27.529C1.87508 25.9939 2.97512 20.0137 7.28896 20.0137H11.0866C13.6179 20.0137 15.6699 17.9616 15.6699 15.4303V7.40995Z"
                fill="url(#paint1_radial_1045_23546)"
              />
            </g>
            <defs>
              <filter
                id="filter0_ddii_1045_23546"
                x="-9.77516e-05"
                y="0.00039053"
                width="43.0191"
                height="42.8625"
                filterUnits="userSpaceOnUse"
                color-interpolation-filters="sRGB"
              >
                <feFlood flood-opacity="0" result="BackgroundImageFix" />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset dx="-2" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0.336951 0 0 0 0 0.666955 0 0 0 1 0"
                />
                <feBlend
                  mode="normal"
                  in2="BackgroundImageFix"
                  result="effect1_dropShadow_1045_23546"
                />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset dx="-1" />
                <feGaussianBlur stdDeviation="1.2" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0.00784314 0 0 0 0 0.686275 0 0 0 0 0.878431 0 0 0 1 0"
                />
                <feBlend
                  mode="normal"
                  in2="effect1_dropShadow_1045_23546"
                  result="effect2_dropShadow_1045_23546"
                />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="effect2_dropShadow_1045_23546"
                  result="shape"
                />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset dx="4" dy="2" />
                <feGaussianBlur stdDeviation="2" />
                <feComposite
                  in2="hardAlpha"
                  operator="arithmetic"
                  k2="-1"
                  k3="1"
                />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
                />
                <feBlend
                  mode="normal"
                  in2="shape"
                  result="effect3_innerShadow_1045_23546"
                />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset dx="1" dy="-1" />
                <feGaussianBlur stdDeviation="1.2" />
                <feComposite
                  in2="hardAlpha"
                  operator="arithmetic"
                  k2="-1"
                  k3="1"
                />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0.00784314 0 0 0 0 0.752941 0 0 0 0 0.909804 0 0 0 1 0"
                />
                <feBlend
                  mode="normal"
                  in2="effect3_innerShadow_1045_23546"
                  result="effect4_innerShadow_1045_23546"
                />
              </filter>
              <radialGradient
                id="paint0_radial_1045_23546"
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(31.6699 20.5137) rotate(75) scale(32.6112)"
              >
                <stop stop-color="#8C00FF" />
                <stop offset="1" stop-color="#0283FF" stop-opacity="0" />
              </radialGradient>
              <radialGradient
                id="paint1_radial_1045_23546"
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(15.6699 36.5137) rotate(32.3827) scale(28.941)"
              >
                <stop stop-color="#00EAFF" />
                <stop offset="1" stop-color="#0283FF" stop-opacity="0" />
              </radialGradient>
            </defs>
          </svg>

          <span className="app__logo-text">Picaton</span>
        </div>

        <div className="app__page-switcher app__page-switcher--desktop">
          <PageSwitcher
            value={
              currentPage === "contact-profile"
                ? previousPage
                : (currentPage as PageType)
            }
            onChange={handlePageChange}
            onSearchSubmit={handleTabBarSearch}
          />
        </div>

        <div className="app__actions">
          <span className="app__user">{user?.first_name}</span>
          <button className="app__logout" onClick={logout} title="Выйти">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className={`app__main${isChatOpen ? " app__main--chat-open" : ""}`}>
        {currentPage === "collaboration" && <CollaborationPage />}
        {currentPage === "chats" && (
          <ChatsPage
            openUserId={chatTargetUser?.id}
            openUserData={
              chatTargetUser
                ? {
                    id: chatTargetUser.id,
                    first_name: chatTargetUser.first_name,
                    last_name: chatTargetUser.last_name || "",
                    avatar_url: chatTargetUser.avatar_url,
                  }
                : undefined
            }
            onChatOpened={() => setChatTargetUser(null)}
            onChatViewChange={setIsChatOpen}
            onViewProfile={(userId, userData) => {
              navigateToContactProfile({
                user: {
                  id: userId,
                  first_name: userData.first_name,
                  last_name: userData.last_name,
                  avatar_url: userData.avatar_url || null,
                  bio: null,
                  ai_generated_bio: null,
                  location: null,
                  tags: [],
                  search_tags: [],
                  contacts: [],
                  profile_completeness: 0,
                },
                savedContact: null,
                returnPage: "chats",
              });
            }}
          />
        )}
        {currentPage === "contacts" && (
          <ContactsPage
            onOpenContact={(user) => navigateToChat(user)}
            initialSearchQuery={tabBarSearchQuery}
            onSearchQueryConsumed={() => setTabBarSearchQuery(undefined)}
          />
        )}
        {currentPage === "profile" && (
          <ProfilePage
            onShareContact={(cards) =>
              navigateToShareContact({
                cards,
                returnPage: "profile",
              })
            }
            openCardId={profileOpenCardId}
            onCardOpened={() => setProfileOpenCardId(undefined)}
            onNavigateToContacts={() => handlePageChange("contacts")}
          />
        )}
        {currentPage === "company" && (
          <CompanyPage
            onOpenContact={(user, cardId) =>
              navigateToContactProfile({
                user,
                cardId,
                savedContact: null,
                returnPage: "company",
              })
            }
          />
        )}
        {currentPage === "contact-profile" && contactProfileData && (
          <ContactProfilePage
            user={contactProfileData.user}
            cardId={contactProfileData.cardId}
            cardIds={contactProfileData.cardIds}
            savedContact={contactProfileData.savedContact}
            onBack={navigateBackFromContactProfile}
            onContactSaved={() => {
              setInviteMessage({
                type: "success",
                text: "Контакт сохранен!",
              });
            }}
            onContactDeleted={() => {
              setInviteMessage({
                type: "success",
                text: "Контакт удален",
              });
            }}
            singleCardMode={contactProfileData.singleCardMode}
          />
        )}
        {currentPage === "share-contact" && shareContactData && (
          <ShareContactPage
            cards={shareContactData.cards}
            onBack={navigateBackFromShareContact}
            onOpenCard={(card) => navigateToCardFromShareContact(card.id)}
            onPreview={navigateToPreviewFromShareContact}
          />
        )}
      </main>

      {/* Мобильный футер с навигацией */}
      <footer
        className={`app__footer${isChatOpen ? " app__footer--hidden" : ""}`}
      >
        <PageSwitcher
          value={
            currentPage === "contact-profile" || currentPage === "share-contact"
              ? previousPage
              : (currentPage as PageType)
          }
          onChange={handlePageChange}
          onSearchSubmit={handleTabBarSearch}
        />
      </footer>

      {/* Email Modal for Telegram users */}
      {user && (
        <EmailModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          userId={user.id}
          onEmailUpdated={async () => {
            // Обновляем данные пользователя после изменения email
            await refreshUser();
          }}
        />
      )}
    </div>
  );
}

function UnauthenticatedApp() {
  // Сохраняем токен приглашения для использования после авторизации
  useEffect(() => {
    const token = getInviteTokenFromUrl();
    if (token) {
      saveInviteToken(token);
      // Очищаем URL
      window.history.replaceState({}, "", "/");
    }
  }, []);

  return (
    <div className="app">
      <LoginPage />
    </div>
  );
}

// Проверяем, нужно ли показывать онбординг (новый пользователь без имени)
function needsOnboarding(user: ReturnType<typeof useAuth>["user"]): boolean {
  if (!user) return false;
  // Если у пользователя нет имени или фамилии — показываем онбординг
  return !user.first_name?.trim() || !user.last_name?.trim();
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="app app--loading">
        <div className="app__loader">
          <div className="app__spinner" />
          <span>Загрузка...</span>
        </div>
      </div>
    );
  }

  // Показываем онбординг для новых пользователей
  if (isAuthenticated && needsOnboarding(user)) {
    return (
      <div className="app">
        <OnboardingPage />
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedApp /> : <UnauthenticatedApp />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
