import { useParams } from "react-router-dom";
import { V2NextQuotationList } from "./V2NextQuotationList";
import { V2NextWizard } from "./V2NextWizard";

export function CotizadorV2NextPage() {
  const { id } = useParams();

  if (id) {
    return <V2NextWizard quotationId={Number(id)} />;
  }

  return <V2NextQuotationList />;
}
