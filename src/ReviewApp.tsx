import React, { useEffect, useState } from "react";
import styles from "./App.module.css";
import LoginScreen from "./login/LoginScreen";

import useStickyState from "./helpers/StickyState";

import * as dsnpLink from "./dsnpLink";
import { Network, User, UserAccount } from "./types";
import Header from "./chrome/Header";
import Feed from "./Feed";
import { Col, ConfigProvider, Layout, Row, Spin } from "antd";
import { getContext, setAccessToken } from "./service/AuthService";
import { Content } from "antd/es/layout/layout";
import { getUserProfile } from "./service/UserProfileService";
import { HeaderProfile } from "./chrome/HeaderProfile";
import { setIpfsGateway } from "./service/IpfsService";
import AuthErrorBoundary from "./AuthErrorBoundary";
import NewReview from "./content/NewReview";
import ReviewProcessor from "./content/ReviewProcessor";

const ReviewApp = (): JSX.Element => {
  const _fakeUser = {
    address: "0x",
    expiresIn: 100,
    accessToken: "23",
    handle: "handle-test",
    dsnpId: 1,
  };
  const [userAccount, setUserAccount] = useStickyState<UserAccount | undefined>(
    undefined,
    "user-account",
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [network, setNetwork] = useState<Network>("testnet");

  // Test if session is still valid
  React.useEffect(() => {
    dsnpLink.authAssert(getContext(), {}).catch((e) => {
      setUserAccount(undefined);
    });
  });

  if (userAccount) {
    setAccessToken(userAccount.accessToken, userAccount.expires);
  }

  // TODO probably an easier way to read query params
  if (!location.search || !location.search.startsWith("?")) {
    return <div>Must specify query string</div>;
  }
  const params = new URLSearchParams(location.search.substring(1));
  const hasReviewText: boolean = params.get("text")
    ? params.get("text") !== ""
    : false;

  const handleLogin = async (
    account: UserAccount,
    providerInfo: dsnpLink.ProviderResponse,
  ) => {
    setLoading(true);
    setAccessToken(account.accessToken, account.expires);
    providerInfo.ipfsGateway && setIpfsGateway(providerInfo.ipfsGateway);
    setNetwork(providerInfo.network);
    setUserAccount(account);
    setLoading(false);
  };

  const handleLogout = () => {
    setUserAccount(undefined);
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#f37a21",
          colorSuccess: "#29fd47",
          colorWarning: "#ff7f0e",
          colorInfo: "#f37a21",
        },
      }}
    >
      <Layout className={styles.root}>
        <Header account={userAccount} logout={handleLogout} />
        {!userAccount && (
          <Content className={styles.content}>
            <LoginScreen onLogin={handleLogin} />
          </Content>
        )}
        {userAccount && (
          <Content className={styles.content}>
            <Spin spinning={loading}>
              <Row>
                <Col sm={24} md={12} lg={24 - 8}>
                  <AuthErrorBoundary onError={handleLogout}>
                    {!hasReviewText && (
                      <NewReview
                        onSuccess={() => {
                          setIsPosting(true);
                          setTimeout(() => {
                            setIsPosting(false);
                          }, 14_000);
                        }}
                        onCancel={() => {
                          /*FIXME*/
                        }}
                        account={userAccount}
                      />
                    )}
                    {hasReviewText && <ReviewProcessor account={userAccount} />}
                  </AuthErrorBoundary>
                </Col>
              </Row>
            </Spin>
          </Content>
        )}
      </Layout>
    </ConfigProvider>
  );
};

export default ReviewApp;
