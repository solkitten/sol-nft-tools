import React, { useContext, useState } from "react";
import { getMeta } from "../util/get-meta";
import { download } from "../util/download";
import jsonFormat from "json-format";
import { ModalContext } from "../providers/modal-provider";
import { useForm } from "react-hook-form";
import { getAddresses, validateSolAddressArray } from "../util/validators";
import { useEndpoint } from "../hooks/use-endpoint";
import { AlertContext } from "../providers/alert-provider";

export default function GetMeta() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const [loading, setLoading] = useState(false);
  const [counter, setCounter] = useState(0);
  const [len, setLen] = useState(0);
  const { setModalState } = useContext(ModalContext);
  const { endpoint } = useEndpoint();
  const { setAlertState } = useContext(AlertContext);

  const fetchMeta = ({ mints }: { mints: string }) => {
    const parsed = getAddresses(mints);

    setAlertState({
      message: "Downloading your data.",
      open: true
    });

    setLen(parsed.length);
    setLoading(true);
    getMeta(parsed, setCounter, endpoint).subscribe({
      next: (e) => {
        download("gib-meta.json", jsonFormat(e, { size: 1, type: "tab" }));
        setLoading(false);
      },
      error: (e) => {
        setModalState({
          message: e?.message ? e.message : "An error occurred",
          open: true,
        });
        setLoading(false);
      },
      complete: () => {
        setAlertState({
          message: "",
          open: false
        });
      },
    });
  };

  return (
    <div>
      <div className="prose max-w-full text-center mb-3">
        <h1 className="text-4xl">Token Metadata</h1>
        <hr className="opacity-10 my-4" />
      </div>
      <p className="px-2 text-center">
        This tool gives you onchain an arweave/ipfs metadata from Solana Mint
        IDs.
      </p>
      <hr className="opacity-10 my-4" />
      <div className="card bg-gray-900 max-w-full">
        <form
          onSubmit={handleSubmit(fetchMeta)}
          className="w-full flex flex-col"
        >
          <div className="card-body">
            <label htmlFor="mints" className="mb-4">
              Please enter SOL mint IDs to get their metadata
            </label>
            <textarea
              {...register("mints", { validate: validateSolAddressArray, required: 'Field is required' })}
              rows={4}
              className={`textarea w-full shadow-lg ${
                !!errors?.mints && "input-error"
              }`}
              id="mints"
              name="mints"
            />
            {!!errors?.mints?.message && (
              <label className="label text-error">
                {errors?.mints?.message}
              </label>
            )}
            <div className="text-center mt-6">
              <button
                className={`btn btn-primary rounded-box shadow-lg ${
                  loading ? "loading" : ""
                }`}
                type="submit"
              >
                {loading ? `${counter} / ${len}` : 'Get Meta'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
