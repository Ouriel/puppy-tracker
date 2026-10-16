import { Toast, ToastProvider } from '@heroui/react';
import { useI18n } from '../../i18n';

/**
 * The toast HeroUI's ToastProvider draws by default, with one change: HeroUI names its close button "Close" in every
 * language, so the app names it. No spinner: the app never shows a loading toast.
 */
export const AppToastProvider = () => {
  const { t } = useI18n();
  return (
    <ToastProvider placement="bottom">
      {({ toast: item }) => {
        const { title, description, indicator, variant, actionProps } = item.content ?? {};
        // HeroUI's breakpoint: on a phone the action button sits under the text.
        // ponytail: read when the toast renders, not on resize; a resized window gets it right from the next toast
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        // 44 px tall, like every other target (Undo after a one-tap log, Retry after a failed one)
        const action = actionProps?.children ? <Toast.ActionButton {...actionProps} className="min-h-11" /> : null;
        return (
          <Toast toast={item} placement="bottom" variant={variant}>
            {indicator === null ? null : <Toast.Indicator variant={variant}>{indicator}</Toast.Indicator>}
            <Toast.Content>
              {title ? <Toast.Title>{title}</Toast.Title> : null}
              {description ? <Toast.Description>{description}</Toast.Description> : null}
              {isMobile && action}
            </Toast.Content>
            {!isMobile && action}
            <Toast.CloseButton aria-label={t.potty.close} />
          </Toast>
        );
      }}
    </ToastProvider>
  );
};
