// @flow
import { t } from '@lingui/macro';
import { Trans } from '@lingui/macro';
import { I18n } from '@lingui/react';
import { type I18n as I18nType } from '@lingui/core';
import * as React from 'react';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import FlatButton from '../UI/FlatButton';
import Dialog from '../UI/Dialog';
import UserProfileContext, { type UserProfile } from './UserProfileContext';
import { Column, Line } from '../UI/Grid';
import {
  getSubscriptionPlans,
  type PlanDetails,
  changeUserSubscription,
  getRedirectToCheckoutUrl,
} from '../Utils/GDevelopServices/Usage';
import RaisedButton from '../UI/RaisedButton';
import CheckCircle from '@material-ui/icons/CheckCircle';
import EmptyMessage from '../UI/EmptyMessage';
import { showMessageBox, showErrorBox } from '../UI/Messages/MessageBox';
import LeftLoader from '../UI/LeftLoader';
import PlaceholderMessage from '../UI/PlaceholderMessage';
import {
  sendSubscriptionDialogShown,
  sendChoosePlanClicked,
} from '../Utils/Analytics/EventSender';
import SubscriptionPendingDialog from './SubscriptionPendingDialog';
import Window from '../Utils/Window';
import Text from '../UI/Text';

const styles = {
  descriptionText: {
    marginLeft: 16,
    marginRight: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  card: {
    margin: 16,
  },
  actions: {
    textAlign: 'right',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  bulletIcon: { width: 20, height: 20, marginLeft: 5, marginRight: 10 },
  bulletText: { flex: 1 },
};

type Props = {|
  open: boolean,
  onClose: Function,
|};

type State = {|
  isLoading: boolean,
  subscriptionPendingDialogOpen: boolean,
|};

export default class SubscriptionDialog extends React.Component<Props, State> {
  state = { isLoading: false, subscriptionPendingDialogOpen: false };

  componentDidMount() {
    if (this.props.open) {
      sendSubscriptionDialogShown();
    }
  }

  componentWillReceiveProps(newProps: Props) {
    if (!this.props.open && newProps.open) {
      sendSubscriptionDialogShown();
    }
  }

  choosePlan = (
    i18n: I18nType,
    userProfile: UserProfile,
    plan: PlanDetails
  ) => {
    const { getAuthorizationHeader, subscription, profile } = userProfile;
    if (!profile || !subscription) return;
    sendChoosePlanClicked(plan.planId);

    if (subscription.stripeSubscriptionId) {
      //eslint-disable-next-line
      const answer = confirm(
        plan.planId
          ? i18n._(t`Are you sure you want to subscribe to this new plan?`)
          : i18n._(t`Are you sure you want to cancel your subscription?`)
      );
      if (!answer) return;

      // We already have a stripe customer, change the subscription without
      // asking for the user card.
      this.setState({ isLoading: true });
      changeUserSubscription(getAuthorizationHeader, profile.uid, {
        planId: plan.planId,
      }).then(
        () => this.handleUpdatedSubscriptionSuccess(i18n, userProfile, plan),
        (err: Error) => this.handleUpdatedSubscriptionFailure(i18n, err)
      );
    } else {
      this.setState({
        subscriptionPendingDialogOpen: true,
      });
      Window.openExternalURL(
        getRedirectToCheckoutUrl(
          plan.planId || '',
          profile.uid,
          profile.email || ''
        )
      );
    }
  };

  handleUpdatedSubscriptionSuccess = (
    i18n: I18nType,
    userProfile: UserProfile,
    plan: PlanDetails
  ) => {
    userProfile.onRefreshUserProfile();
    this.setState({ isLoading: false });
    if (plan.planId) {
      showMessageBox(
        i18n._(
          t`Congratulations, your new subscription is now active!\n\nYou can now use the services unlocked with this plan.`
        )
      );
    } else {
      showMessageBox(
        i18n._(
          t`Your subscription was properly cancelled. Sorry to see you go!`
        )
      );
    }
  };

  handleUpdatedSubscriptionFailure = (i18n: I18nType, err: Error) => {
    this.setState({ isLoading: false });
    showErrorBox(
      i18n._(
        t`Your subscription could not be updated. Please try again later!`
      ),
      err
    );
  };

  _renderPrice(plan: PlanDetails): React.Node {
    return !plan.monthlyPriceInEuros ? (
      <Trans>Free</Trans>
    ) : (
      <Trans>{plan.monthlyPriceInEuros}€/month</Trans>
    );
  }

  _isLoading = (userProfile: UserProfile) =>
    !userProfile.subscription || !userProfile.profile || this.state.isLoading;

  render() {
    const { open, onClose } = this.props;
    const { subscriptionPendingDialogOpen } = this.state;

    return (
      <I18n>
        {({ i18n }) => (
          <UserProfileContext.Consumer>
            {(userProfile: UserProfile) => (
              <Dialog
                actions={[
                  <FlatButton
                    label={<Trans>Close</Trans>}
                    key="close"
                    primary={false}
                    onClick={onClose}
                  />,
                ]}
                onRequestClose={onClose}
                modal
                open={open}
                noMargin
              >
                <Column>
                  <Line>
                    <Text>
                      <Trans>
                        Get a subscription to package your games for Android,
                        Windows, macOS and Linux, use live preview over wifi and
                        more. With a subscription, you're also supporting the
                        development of GDevelop, which is an open-source
                        software.
                      </Trans>
                    </Text>
                  </Line>
                </Column>
                {getSubscriptionPlans().map(plan => (
                  <Card key={plan.planId || ''} style={styles.card}>
                    <CardHeader
                      title={
                        <span>
                          <b>{plan.name}</b> - {this._renderPrice(plan)}
                        </span>
                      }
                      subheader={
                        plan.smallDescription
                          ? i18n._(plan.smallDescription)
                          : ''
                      }
                    />
                    <CardContent>
                      {plan.descriptionBullets.map(
                        (descriptionBullet, index) => (
                          <Column key={index} expand>
                            <Line noMargin alignItems="center">
                              <CheckCircle style={styles.bulletIcon} />
                              <Text style={styles.bulletText}>
                                {i18n._(descriptionBullet.message)}{' '}
                                {descriptionBullet.isLocalAppOnly && (
                                  <Trans>(on the desktop app only)</Trans>
                                )}
                              </Text>
                            </Line>
                          </Column>
                        )
                      )}
                      <Text style={styles.descriptionText}>
                        {plan.extraDescription
                          ? i18n._(plan.extraDescription)
                          : ''}
                      </Text>
                    </CardContent>
                    <CardActions style={styles.actions}>
                      {userProfile.subscription &&
                      userProfile.subscription.planId === plan.planId ? (
                        <FlatButton
                          disabled
                          label={<Trans>This is your current plan</Trans>}
                          onClick={() =>
                            this.choosePlan(i18n, userProfile, plan)
                          }
                        />
                      ) : plan.planId ? (
                        <LeftLoader isLoading={this._isLoading(userProfile)}>
                          <RaisedButton
                            primary
                            disabled={this._isLoading(userProfile)}
                            label={<Trans>Choose this plan</Trans>}
                            onClick={() =>
                              this.choosePlan(i18n, userProfile, plan)
                            }
                          />
                        </LeftLoader>
                      ) : (
                        <LeftLoader isLoading={this._isLoading(userProfile)}>
                          <FlatButton
                            disabled={this._isLoading(userProfile)}
                            label={<Trans>Cancel your subscription</Trans>}
                            onClick={() =>
                              this.choosePlan(i18n, userProfile, plan)
                            }
                          />
                        </LeftLoader>
                      )}
                    </CardActions>
                  </Card>
                ))}
                <Column>
                  <Line>
                    <EmptyMessage>
                      <Trans>
                        Subscriptions can be stopped at any time. GDevelop uses
                        Stripe.com for secure payment. No credit card data is
                        stored by GDevelop: everything is managed by Stripe
                        secure infrastructure.
                      </Trans>
                    </EmptyMessage>
                  </Line>
                </Column>
                {!userProfile.authenticated && (
                  <PlaceholderMessage>
                    <Text>
                      <Trans>
                        Create a GDevelop account to continue. It's free and
                        you'll be able to access to online services like
                        one-click build for Android:
                      </Trans>
                    </Text>
                    <RaisedButton
                      label={<Trans>Create my account</Trans>}
                      primary
                      onClick={userProfile.onLogin}
                    />
                    <FlatButton
                      label={<Trans>Not now, thanks</Trans>}
                      onClick={onClose}
                    />
                  </PlaceholderMessage>
                )}
                {subscriptionPendingDialogOpen && (
                  <SubscriptionPendingDialog
                    userProfile={userProfile}
                    onClose={() => {
                      this.setState(
                        {
                          subscriptionPendingDialogOpen: false,
                        },
                        () => userProfile.onRefreshUserProfile()
                      );
                    }}
                  />
                )}
              </Dialog>
            )}
          </UserProfileContext.Consumer>
        )}
      </I18n>
    );
  }
}
