import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import { useCallback, useEffect, useState } from "react";
import { Divider, Button, Card, notification, Spin, Input, Form } from "antd";
import { FileUpload } from "./file-upload";
import { DownloadOutlined } from "@ant-design/icons";
import { download } from "../util/download";
import jsonFormat from "json-format";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { makeArweaveBundleUploadGenerator } from "../util/upload-arweave-bundles/upload-generator";

export const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const uploadToArweave = async (transaction) => {
  const uploader = await arweave.transactions.getUploader(transaction);
  while (!uploader.isComplete) {
    await uploader.uploadChunk();
    console.log(
      `${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`
    );
  }
};

const fileToBuffer = (
  file: File
): Promise<{ buffer: ArrayBuffer; file: File }> => {
  return new Promise((resolve) => {
    var reader = new FileReader();

    reader.onload = function (readerEvt) {
      var buffer = readerEvt.target.result;

      resolve({
        buffer: buffer as ArrayBuffer,
        file,
      });
    };

    reader.readAsArrayBuffer(file);
  });
};
export const generateArweaveWallet = async () => {
  const key = await arweave.wallets.generate();
  localStorage.setItem("arweave-key", JSON.stringify(key));
  return key;
};

export const getKeyForJwk = (jwk) => arweave.wallets.jwkToAddress(jwk);

export default function ARUpload() {
  const [jwk, setJwk] = useState<JWKInterface>();
  const [address, setAddress] = useState<string>();
  const [balance, setBalance] = useState("none");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [jwkForm] = Form.useForm();

  const generate = () =>
    generateArweaveWallet().then(async (jwk) => {
      setJwk(jwk);
      const a = await getKeyForJwk(jwk);
      setAddress(a);
    });

  useEffect(() => {
    const previousKey = localStorage.getItem("arweave-key");
    if (previousKey) {
      if (!address) {
        try {
          const k = JSON.parse(previousKey);
          setJwk(k);
          getKeyForJwk(k).then((a) => {
            setAddress(a);
          });
        } catch (e) {
          console.log(e);
          generate();
        }
      }
    }
  }, [address, jwk]);

  const upload = useCallback(async () => {
    setLoading(true);

    // Arweave Native storage leverages Arweave Bundles.
    // It allows to encapsulate multiple independent data transactions
    // into a single top level transaction,
    // which pays the reward for all bundled data.
    // https://github.com/Bundlr-Network/arbundles
    // Each bundle consists of one or multiple files.
    // Initialize the Arweave Bundle Upload Generator.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator
    const arweaveBundleUploadGenerator = makeArweaveBundleUploadGenerator(
      files,
      jwk
    );

    let bundleUploader = arweaveBundleUploadGenerator.next();
    let results = [];
     // Loop over every uploaded bundle
    while (!bundleUploader.done) {
      const bundlingResult = await bundleUploader.value;
      if (bundlingResult) {
        results.push(bundlingResult);
      }
      bundleUploader = arweaveBundleUploadGenerator.next();
    }

    console.log(results);
    setLoading(false);
    download(`AR-upload-${Date.now()}.json`, jsonFormat(results));
  }, [files, jwk]);

  const downloadKey = useCallback(() => {
    if (!jwk || !address) {
      return;
    }
    download(`AR-${address}.json`, jsonFormat(jwk));
  }, [address, jwk]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (address) {
        const balance = await arweave.wallets.getBalance(address);
        setBalance(arweave.ar.winstonToAr(balance));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [address, balance]);

  const handleFiles = useCallback(async (_files: File[]) => {
    const loaded = await Promise.all(_files.map((f) => fileToBuffer(f)));
    setFiles(loaded);
  }, []);

  const importKey = useCallback(async () => {
    const { key } = jwkForm.getFieldsValue();
    try {
      const parsed = JSON.parse(key);
      const addr = await arweave.wallets.jwkToAddress(parsed);
      setJwk(parsed);
      setAddress(addr);
      localStorage.setItem("arweave-key", key);
      notification.open({
        message: "Successfully imported key!",
      });
    } catch (e) {
      notification.open({
        message: "Key could not be imported!",
      });
    }
  }, [jwkForm]);

  return (
    <>
      <p>
        Gib AR-Links lets you upload files to arweave. Please make sure to use
        files smaller than 250mb. Caution: Beta Version! It is possible that
        some files may fail to upload without error.
      </p>
      <p>
        Send some AR to this wallet to start uploading. You can download and
        empty the wallet later. You can get AR on{" "}
        <a href="https://binance.com" target="_blank" rel="noopener noreferrer">
          Binance
        </a>
      </p>
      <Divider />

      <div>
        {jwk && (
          <Card
            extra={
              <>
                <CopyToClipboard
                  text={address}
                  onCopy={() =>
                    notification.open({ message: "Copied to clipboard!" })
                  }
                >
                  <a style={{ marginRight: "1rem" }}>Copy Address</a>
                </CopyToClipboard>
                <a onClick={downloadKey}>Download Wallet</a>
              </>
            }
            title="Wallet"
          >
            <p>Address: {address}</p>
            <p>
              Balance:{" "}
              {balance === "none" ? (
                <Spin style={{ marginLeft: "1rem" }} />
              ) : (
                balance
              )}
            </p>
            <Divider />
            <FileUpload setFiles={handleFiles} />
          </Card>
        )}
        {!jwk && (
          <Card>
            <Form form={jwkForm}>
              <h3 style={{ textAlign: "center" }}>No Wallet found.</h3>
              <Divider />
              <Form.Item>
                <Button
                  size="large"
                  style={{ display: "block", margin: "0 auto", minWidth: 320 }}
                  onClick={() => generate()}
                >
                  Generate Wallet
                </Button>
              </Form.Item>
              <div style={{ textAlign: "center" }}>Or</div>
              <br />
              <Card>
                <h3 style={{ textAlign: "center" }}>
                  Import Wallet (JWK JSON)
                </h3>
                <br />
                <Form.Item name="key">
                  <Input.TextArea rows={10} />
                </Form.Item>
                <Form.Item>
                  <Button
                    size="large"
                    style={{
                      display: "block",
                      margin: "0 auto",
                      minWidth: 320,
                    }}
                    onClick={() => importKey()}
                  >
                    Import
                  </Button>
                </Form.Item>
              </Card>
            </Form>
          </Card>
        )}
      </div>

      {jwk && (
        <>
          <br />
          <Button
            type="primary"
            loading={loading}
            shape="round"
            disabled={!files.length}
            icon={<DownloadOutlined />}
            size="large"
            style={{ margin: "0 auto", display: "block" }}
            onClick={upload}
          >
            {loading ? "Uploading..." : "Gib AR Links!"}
          </Button>
          <br />
        </>
      )}
    </>
  );
}
