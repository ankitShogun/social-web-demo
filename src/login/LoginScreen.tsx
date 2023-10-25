import React, { useEffect, useState } from "react";
import { Button, Spin, Row, Col, Form, Space } from "antd";
import { web3Accounts, web3Enable } from "@polkadot/extension-dapp";
import type { InjectedAccountWithMeta } from "@polkadot/extension-inject/types";
import MissingWallet from "./MissingWallet";
import * as dsnpLink from "../dsnpLink";
import CreateIdentity from "./CreateIdentity";
import Login from "./Login";
import { HandlesMap, UserAccount } from "../types";
import styles from "./LoginScreen.module.css";
import { parentURLs } from "../helpers/constants";

const dsnpLinkCtx = dsnpLink.createContext();

interface LoginScreenProps {
  onLogin: (
    account: UserAccount,
    providerInfo: dsnpLink.ProviderResponse,
  ) => void;
}

const toHandlesMap = (
  accountList: InjectedAccountWithMeta[],
  handles: dsnpLink.HandlesResponse[],
) => {
  const handleOnlyMap = handles.reduce(
    (prev, cur) => (cur.handle ? prev.set(cur.publicKey, cur.handle) : prev),
    new Map(),
  );
  const handleMap: HandlesMap = new Map();
  for (const account of accountList) {
    handleMap.set(account.address, {
      account,
      handle: handleOnlyMap.get(account.address) || null,
    });
  }
  return handleMap;
};

const LoginScreen = ({ onLogin }: LoginScreenProps): JSX.Element => {
  // Assume it has a wallet extension until after we have called enable
  const [hasWalletExtension, setHasWalletExtension] = useState(true);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [providerInfo, setProviderInfo] = useState<dsnpLink.ProviderResponse>();
  const [handlesMap, setHandlesMap] = useState<HandlesMap>(new Map());

  const setAuthState = async (allAccounts: InjectedAccountWithMeta[]) => {
    const accountsWithHandles = await dsnpLink.authHandles(
      dsnpLinkCtx,
      {},
      allAccounts.map((account) => account.address),
    );

    setHandlesMap(toHandlesMap(allAccounts, accountsWithHandles));
    setExtensionConnected(true);
    setIsLoading(false);
  };

  useEffect(() => {
    const getProviderInfo = async () => {
      const fetched = await dsnpLink.authProvider(dsnpLinkCtx, {});
      setProviderInfo(fetched);
      setTimeout(connectExtension, 1_000);
    };
    getProviderInfo();
  }, [setProviderInfo, setIsLoading]);

  React.useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!parentURLs.includes(event.origin)) return;
      if (event.data.type && event.data.type === "polkaAccounts") {
        setAuthState(event.data.data);
      }
    }

    //@ts-ignore
    window.addEventListener("message", handleMessage);

    return () => {
      //@ts-ignore
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const connectExtension = async () => {
    try {
      setIsLoading(true);
      // If the app is running inside an iframe
      if (window.location !== window.parent.location) {
        window.parent.postMessage({ type: "enablePolka" }, "*");
        setIsLoading(false);
      } else {
        const enabled = await web3Enable("Social Web Example Client");
        setHasWalletExtension(true);
        if (enabled.length > 0) {
          const allAccounts = await web3Accounts();
          // Check each account for a handle.
          const accountsWithHandles = await dsnpLink.authHandles(
            dsnpLinkCtx,
            {},
            allAccounts.map((account) => account.address),
          );

          setHandlesMap(toHandlesMap(allAccounts, accountsWithHandles));
          setExtensionConnected(true);
          setIsLoading(false);
        } else {
          setIsLoading(false);
        }
      }
    } catch (e) {
      setHasWalletExtension("web3" in window);
      setHandlesMap(new Map());
      setExtensionConnected(false);
      setIsLoading(false);
      console.error(e);
    }
  };

  if (extensionConnected && !providerInfo) {
    throw new Error("Unable to get connection to backend");
  }

  return (
    <div className={styles.root}>
      <Spin tip="Loading" size="large" spinning={isLoading}>
        <Row className={styles.content}>
          {!extensionConnected && !isLoading && (
            <MissingWallet hasWalletExtension={hasWalletExtension} />
          )}
          {!isLoading && !extensionConnected && (
            <Col span={24}>
              <Space direction="horizontal" className={styles.connectButton}>
                <Button size="large" type="primary" onClick={connectExtension}>
                  Connect to Wallet Extension
                </Button>
              </Space>
            </Col>
          )}
          {extensionConnected && providerInfo && (
            <>
              <Col>
                <Login
                  onLogin={(account) => onLogin(account, providerInfo)}
                  handlesMap={handlesMap}
                />
              </Col>
              <Col>
                <CreateIdentity
                  onLogin={onLogin}
                  providerInfo={providerInfo}
                  handlesMap={handlesMap}
                />
              </Col>
            </>
          )}
        </Row>
      </Spin>
    </div>
  );
};

export default LoginScreen;
