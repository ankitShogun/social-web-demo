import React, { useState } from "react";
import { Button, Select, Spin, Form } from "antd";
import Title from "antd/es/typography/Title";

import * as dsnpLink from "../dsnpLink";
import { HandlesMap, UserAccount } from "../types";
import { signPayloadWithExtension } from "./signing";
import styles from "./Login.module.css";
import { getContext } from "../service/AuthService";
import { parentURLs } from "../helpers/constants";

interface LoginProps {
  handlesMap: HandlesMap;
  onLogin: (account: UserAccount) => void;
}

const Login = ({ onLogin, handlesMap }: LoginProps): JSX.Element => {
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [savedChallenge, setSavedChallenge] = useState("");

  const handleIframeLogin = async (
    signedChallenge: any,
    handle: string,
    dsnpLinkCtx: any,
    savedChallenge: string,
  ) => {
    setIsLoading(true);
    try {
      if (!signedChallenge.startsWith("0x")) {
        throw Error("Unable to sign: " + signedChallenge);
      }

      const { accessToken, expires, dsnpId } = await dsnpLink.authLogin(
        dsnpLinkCtx,
        {},
        {
          algo: "SR25519",
          encoding: "hex",
          encodedValue: signedChallenge,
          publicKey: selectedAccount,
          challenge: savedChallenge,
        },
      );
      onLogin({
        address: selectedAccount,
        handle,
        accessToken,
        expires,
        dsnpId,
      });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!selectedAccount) return;
    const handle = handlesMap.get(selectedAccount)?.handle;
    if (!handle) return;
    setIsLoading(true);

    try {
      const dsnpLinkCtx = getContext();
      const { challenge } = await dsnpLink.authChallenge(dsnpLinkCtx, {});
      setSavedChallenge(challenge);

      if (window.location !== window.parent.location) {
        window.parent.postMessage(
          {
            type: "signTransaction",
            data: { selectedAccount, challenge },
          },
          "*",
        );
        setIsLoading(false);
      } else {
        const signedChallenge = await signPayloadWithExtension(
          selectedAccount,
          challenge,
        );

        if (!signedChallenge.startsWith("0x")) {
          throw Error("Unable to sign: " + signedChallenge);
        }

        const { accessToken, expires, dsnpId } = await dsnpLink.authLogin(
          dsnpLinkCtx,
          {},
          {
            algo: "SR25519",
            encoding: "hex",
            encodedValue: signedChallenge,
            publicKey: selectedAccount,
            challenge,
          },
        );
        onLogin({
          address: selectedAccount,
          handle,
          accessToken,
          expires,
          dsnpId,
        });
        setIsLoading(false);
      }
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const handlesValues = [...handlesMap.values()].filter(
    ({ handle }) => !!handle,
  );

  React.useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!parentURLs.includes(event.origin)) return;
      if (event.data.type && event.data.type === "signTransaction") {
        let { signedChallenge } = event.data.data;
        if (!selectedAccount) return;
        const handle = handlesMap.get(selectedAccount)?.handle;
        if (!handle) return;
        const dsnpLinkCtx = getContext();
        handleIframeLogin(signedChallenge, handle, dsnpLinkCtx, savedChallenge);
      }
    }

    //@ts-ignore
    window.addEventListener("message", handleMessage);

    return () => {
      //@ts-ignore
      window.removeEventListener("message", handleMessage);
    };
  }, [selectedAccount, savedChallenge]);

  return (
    <div className={styles.root}>
      <Title level={2}>Use Existing Identity</Title>
      <div>
        <Form layout="vertical" size="large">
          <Spin tip="Loading" size="large" spinning={isLoading}>
            <Form.Item label="">
              <Select<string>
                disabled={handlesValues.length === 0}
                onChange={setSelectedAccount}
                placeholder="Select Account"
                options={handlesValues.map(({ account, handle }) => ({
                  value: account.address,
                  label: handle,
                }))}
              />
            </Form.Item>

            <Form.Item label="">
              <Button type="primary" onClick={handleLogin}>
                Login
              </Button>
            </Form.Item>
          </Spin>
        </Form>
      </div>
    </div>
  );
};

export default Login;
